import { Retrier, type RetryConfig } from "./Retrier";
import { timerWheel, type TimerWheel } from "./TimerWheel";
import { createBatcher, exponentialBackoff, type Batch } from "./utils";
import { eventEmitter } from "./EventEmitter";
import { type QueryDefinition, getQueryInstanceKey } from "./DependencyGraph";

/**
 * Query state tracking
 */
export interface QueryState<TData> {
  /** Current status of the query */
  status: "pending" | "success" | "error";
  /** The resolved data when query is successful */
  data: TData | undefined;
  /** The error when query fails */
  error: unknown;
  /** Timestamp when the data was last fetched successfully */
  dataUpdatedAt: number | undefined;
  /** Timestamp when the error occurred */
  errorUpdatedAt: number | undefined;
  /** Current fetch status */
  fetchStatus: "idle" | "fetching";
  /** Whether the query is prefetched */
  prefetchedAt: number | undefined;
}

/**
 * Options for creating a Query instance (internal use)
 * Note: Most options come from the QueryDefinition and cannot be overridden
 */
export interface QueryOptions<TData, TParams> {
  /** The query definition containing the queryFn and cache options */
  queryDefinition: QueryDefinition<TData, TParams>;
  /** The parameters for this query instance */
  params: TParams;
}

/**
 * Query class that manages an individual query instance's state, fetching, subscribers, and GC.
 * A query instance is a combination of a QueryDefinition and specific parameters.
 *
 * Features:
 * - Tracks query state (status, data, error)
 * - Manages subscribers with automatic refetch on subscribe if stale
 * - Handles retries using Retrier
 * - Schedules garbage collection using TimerWheel when no subscribers remain
 * - Options are immutable and come from the QueryDefinition
 *
 * @example
 * ```typescript
 * const moviesQuery = query({
 *   queryFn: (params: { page: number }) => fetchMovies(params.page),
 *   gcTime: 5000,
 *   staleTime: 30000
 * });
 *
 * const queryInstance = new Query(
 *   moviesQuery,
 *   { page: 1 },
 *   { onRemove: () => cache.delete(key) }
 * );
 *
 * // Subscribe to changes
 * const unsubscribe = queryInstance.subscribe(() => {
 *   console.log('Query updated:', queryInstance.getState());
 * });
 *
 * // Fetch data
 * await queryInstance.fetch();
 *
 * // Later...
 * unsubscribe();
 * ```
 */
interface QueryEnvironment {
  onRemove: () => void;
}

const PREFETCH_FRESHNESS_TIME = 1000 * 5; // 5 seconds
const DEFAULT_GC_TIME = 1000 * 60 * 60; // 60 minutes

export class Query<TData = unknown, TParams = void> {
  private queryDefinition: QueryDefinition<TData, TParams>;
  private params: TParams;
  private state: QueryState<TData>;
  private readonly serializedKeyValue: string;

  // Subscribers
  private subscribers: Set<() => void> = new Set();

  // GC
  private timerWheel: TimerWheel;
  private gcTimerId?: number;

  // Retrier
  private retrier: Retrier;
  private batch: Batch;

  // Promise tracking
  private currentPromise: Promise<TData>;
  private environment: QueryEnvironment;

  // Resolved options from the definition
  private readonly gcTime: number;
  private readonly staleTime: number | "static";
  private readonly retry: RetryConfig;
  private readonly retryDelay:
    | number
    | ((failureCount: number, error: unknown) => number);

  get promise() {
    return this.currentPromise;
  }

  get subscriptions(): number {
    return this.subscribers.size;
  }

  constructor(
    queryDefinition: QueryDefinition<TData, TParams>,
    params: TParams,
    environment: QueryEnvironment
  ) {
    this.queryDefinition = queryDefinition;
    this.params = params;
    this.environment = environment;
    this.timerWheel = timerWheel;
    this.batch = createBatcher();

    // Generate cache key from definition + params
    this.serializedKeyValue = getQueryInstanceKey(params);

    // Extract options from definition (with defaults)
    const config = queryDefinition.config;
    this.gcTime = config.gcTime ?? DEFAULT_GC_TIME;
    this.staleTime = config.staleTime ?? 0;
    this.retry = config.retry ?? 3;
    this.retryDelay =
      config.retryDelay ??
      ((failureCount) => exponentialBackoff(1000, failureCount, 10000));

    // Initialize state
    this.state = {
      status: "pending",
      fetchStatus: "idle",
      data: undefined,
      error: undefined,
      dataUpdatedAt: undefined,
      errorUpdatedAt: undefined,
      prefetchedAt: undefined,
    };

    // Create retrier with options from definition
    this.retrier = new Retrier({
      retry: this.retry,
      retryDelay: this.retryDelay,
    });

    this.retrier.pause();
    this.currentPromise = this.createFetcher();
  }

  /**
   * Get the current state of the query
   */
  getState(): Readonly<QueryState<TData>> {
    return this.state;
  }

  /**
   * Get the query definition and parameters
   */
  getKey(): { definition: QueryDefinition<TData, TParams>; params: TParams } {
    return {
      definition: this.queryDefinition,
      params: this.params,
    };
  }

  get serializedKey(): Readonly<string> {
    return this.serializedKeyValue;
  }

  /**
   * Check if the query data is stale
   */
  isStale(): boolean {
    // If the query is prefetched, it's not stale for some time after the prefetch
    // this is to avoid double fetching the query after it was prefetched but not used yet.
    if (this.state.prefetchedAt != null) {
      return false;
    }

    // If staleTime is 'static', data is never stale (even if never fetched or invalidated)
    if (this.staleTime === "static") {
      return false;
    }

    // If no data has been fetched yet (or was invalidated), it's stale
    if (this.state.dataUpdatedAt == null) {
      return true;
    }

    // If staleTime is Infinity, data is never stale (but can be invalidated)
    if (this.staleTime === Infinity) {
      return false;
    }

    // staleTime can't be less than 1, so we set it to 1 if it's undefined or 0.
    const now = Date.now();

    return now >= this.state.dataUpdatedAt + this.staleTime;
  }

  /**
   * Fetch query data using the queryFn with retry logic
   *
   * @returns Promise that resolves with the query data
   */
  private createFetcher(): Promise<TData> {
    // If already fetching, return the current promise
    if (this.state.fetchStatus === "fetching" && this.currentPromise != null) {
      return this.currentPromise;
    }

    // Create new promise with retrier (before notifying to ensure deduplication)
    const promise = this.retrier
      .execute(() => {
        // Update fetch status
        this.state.fetchStatus = "fetching";
        // Notify after promise is created to ensure deduplication works
        this.notifySubscribers();

        // Call queryFn with params from definition
        return this.queryDefinition.config.queryFn(this.params);
      })
      .then((data) => {
        // Update state on success
        this.state.status = "success";
        this.state.data = data;
        this.state.error = undefined;
        this.state.dataUpdatedAt = Date.now();
        this.state.errorUpdatedAt = undefined;
        this.state.fetchStatus = "idle";

        this.notifySubscribers();

        return data;
      })
      .catch((error) => {
        // Update state on error
        this.state.status = "error";
        this.state.error = error;
        this.state.errorUpdatedAt = Date.now();
        this.state.fetchStatus = "idle";

        this.notifySubscribers();
        throw error;
      })
      .finally(() => {
        this.scheduleGC();
      });

    return promise;
  }

  /**
   * Execute the query
   * @returns Promise that resolves with the query data
   */
  async fetch(parentScopeId?: string): Promise<TData> {
    const scope = eventEmitter.createScope({ parentScopeId });

    scope.emit("query:fetch:start", { key: this.serializedKey });

    try {
      this.retrier.resume();
      const data = await this.currentPromise;
      this.retrier.pause();

      scope.emit("query:fetch:success", {
        key: this.serializedKey,
      });

      return data;
    } catch (error) {
      scope.emit("query:fetch:error", {
        key: this.serializedKey,
        error,
      });
      throw error;
    }
  }

  prefetch(): void {
    const scope = eventEmitter.createScope();

    if (this.state.data != null || this.state.fetchStatus === "fetching") {
      scope.emit("query:prefetch:success", {
        key: this.serializedKey,
      });
      return;
    }

    const now = Date.now();
    this.state.prefetchedAt = now;

    scope.emit("query:prefetch:start", {
      key: this.serializedKey,
    });

    void this.fetch(scope.scopeId)
      .then(() => {
        scope.emit("query:prefetch:success", {
          key: this.serializedKey,
        });

        this.timerWheel.schedule(() => {
          this.state.prefetchedAt = undefined;

          if (this.subscribers.size > 0) {
            return;
          }

          if (import.meta.env.DEV) {
            console.warn(`Query with key ${this.serializedKey} was prefetched but not used 
            within a few seconds.
            Please make sure the key is in use and it is preloaded intentionally`);
          }
        }, PREFETCH_FRESHNESS_TIME);
      })
      .catch((error) => {
        scope.emit("query:prefetch:error", {
          key: this.serializedKey,
          error,
        });
      });
  }

  async enshureData(): Promise<TData> {
    if (this.state.data != null) {
      if (this.isStale()) {
        return this.fetch();
      }

      return this.state.data;
    }

    if (this.state.fetchStatus === "fetching") {
      return await this.currentPromise;
    }

    return this.fetch();
  }
  /**
   * Subscribe to query changes. Increments subscriber count and triggers
   * a refetch if this is the first subscription and data is stale.
   *
   * @param callback - Function to call when query state changes
   * @returns Unsubscribe function
   */
  subscribe(callback: () => void): () => void {
    const wasFirstSubscription = this.subscribers.size === 0;

    if (this.subscribers.has(callback)) {
      return () => {
        this.unsubscribe(callback);
      };
    }

    this.subscribers.add(callback);

    if (wasFirstSubscription) {
      this.retrier.resume();
      this.cancelGC();
    }

    const isStale = this.isStale();

    if (this.state.status === "pending") {
      try {
        callback();
      } catch (error) {
        console.error("Query subscriber error:", error);
      }
    }

    // Batcher caches the `isStale` value on the first call,
    // And keep it until the execution of the callback.
    // So we're sure we cached the value in the beginning of the task,
    // this makes multiple calls of subscribe keep the same value of `isStale`.
    // So we don't refetch the query if it wasn't stale when the first call of subscribe was made.
    this.batch(() => {
      if (isStale && this.state.status === "success") {
        void this.createFetcher();
      }
    });

    return () => {
      this.unsubscribe(callback);
    };
  }

  /**
   * Unsubscribe from query changes. Decrements subscriber count and
   * schedules GC if there are no more subscribers.
   *
   * @param callback - The callback to remove
   */
  private unsubscribe(callback: () => void): void {
    this.subscribers.delete(callback);

    if (this.subscribers.size === 0) {
      this.retrier.pause();
      this.scheduleGC();
    }
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifySubscribers(): void {
    for (const callback of this.subscribers) {
      try {
        callback();
      } catch (error) {
        console.error("Query subscriber error:", error);
      }
    }
  }

  /**
   * Get the number of active subscribers
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  remove(): boolean {
    this.environment.onRemove();
    this.retrier.reset();
    this.cancelGC();

    return true;
  }

  /**
   * Schedule garbage collection using the timer wheel
   */
  private scheduleGC(): void {
    // Cancel any existing GC timer
    this.cancelGC();

    // Don't schedule GC if gcTime is Infinity
    if (this.gcTime === Infinity || this.subscribers.size > 0) {
      return;
    }

    // Schedule GC using timer wheel
    this.gcTimerId = this.timerWheel.schedule(() => {
      this.handleGC();
    }, this.gcTime);
  }

  /**
   * Cancel scheduled garbage collection
   */
  private cancelGC(): void {
    if (this.gcTimerId !== undefined) {
      this.timerWheel.cancel(this.gcTimerId);
      this.gcTimerId = undefined;
    }
  }

  /**
   * Handle garbage collection
   * This method is called when the GC timer fires
   */
  private handleGC(): void {
    // Clear the timer ID since it has fired
    this.gcTimerId = undefined;

    // Check if eligible after clearing timer
    if (this.canBeCollected()) {
      this.remove();
    }
  }

  /**
   * Check if the query is eligible for garbage collection
   * (no subscribers and GC timer has elapsed or not scheduled)
   */
  canBeCollected(): boolean {
    // If the query is prefetched, it's not eligible for garbage collection
    // this is to avoid double fetching the query after it was prefetched but not used yet.
    if (this.state.prefetchedAt != null) {
      return false;
    }

    // Has subscribers, not eligible
    if (this.subscribers.size > 0) {
      return false;
    }

    // GC timer is scheduled, not eligible yet
    if (this.gcTimerId !== undefined) {
      return false;
    }

    // No subscribers and no timer means either:
    // 1. GC time is Infinity (never collect)
    // 2. GC timer already fired
    // We consider it eligible only if gcTime is not Infinity
    return this.gcTime !== Infinity;
  }

  /**
   * Invalidate the query by resetting its state to pending
   * This forces a refetch on next access
   */
  invalidate(parentScopeId?: string): Promise<TData> {
    // Only invalidate if not static
    if (this.staleTime !== "static") {
      this.state.dataUpdatedAt = undefined;

      // If there are subscribers, trigger a refetch
      if (this.subscribers.size > 0) {
        // Reset retrier to allow new execution (cancel sets cancelled=true)
        this.retrier.reset();
        this.retrier.resume();
        this.currentPromise = this.createFetcher();

        return this.fetch(parentScopeId);
      }
    }

    return this.currentPromise;
  }

  /**
   * Reset the query to its initial state
   */
  reset(): void {
    this.state = {
      status: "pending",
      fetchStatus: "idle",
      data: undefined,
      error: undefined,
      dataUpdatedAt: undefined,
      errorUpdatedAt: undefined,
      prefetchedAt: undefined,
    };
    this.cancelGC();
    this.currentPromise = this.createFetcher();
    this.notifySubscribers();
  }

  /**
   * Destroy the query, cleaning up resources
   */
  destroy(): void {
    this.cancelGC();
    this.subscribers.clear();
  }

  refetch(): void {
    void this.fetch();
  }
}
