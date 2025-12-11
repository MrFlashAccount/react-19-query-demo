import { Retrier, type RetryConfig } from "./Retrier";
import { timerWheel, type TimerWheel } from "./TimerWheel";
import { createBatcher, type Batch } from "./batcher";
import { exponentialBackoff } from "./utils";
import { tracer, type Span } from "./tracing";
import {
  type Context,
  type QueryDefinition,
  type QueryFnContext,
  getQueryInstanceKey,
} from "./nodes/query";
import { QueryPromise } from "./QueryPromise";

/**
 * Query state tracking
 */
export interface QueryState<TData> {
  /** Current status of the query */
  status: QueryPromise<TData>["status"];
  /** The resolved data when query is successful */
  data: QueryPromise<TData>["value"];
  /** The error when query fails */
  error: QueryPromise<TData>["reason"];
  /** Timestamp when the data was last fetched successfully */
  dataUpdatedAt: QueryPromise<TData>["dataUpdatedAt"];
  /** Timestamp when the error occurred */
  errorUpdatedAt: QueryPromise<TData>["errorUpdatedAt"];
  /** Current fetch status */
  fetchStatus: QueryPromise<TData>["fetchStatus"];
}

interface QueryEnvironment {
  onRemove: () => void;
  context: Context;
}

const PREFETCH_FRESHNESS_TIME = 1000 * 5; // 5 seconds
const DEFAULT_GC_TIME = 1000 * 60 * 5; // 5 minutes

export class Query<
  QD extends QueryDefinition<TParams, TData>,
  TParams extends unknown = unknown,
  TData extends unknown = unknown
> {
  private queryDefinition: QD;
  private params: TParams;
  private readonly serializedKeyValue: string;
  private prefetchedAt: number | undefined;

  // Subscribers
  private subscribers: Set<() => void> = new Set();

  // GC
  private timerWheel: TimerWheel;
  private gcTimerId?: number;

  // Retrier
  private retrier: Retrier;
  private batch: Batch;

  // Promise tracking
  private currentPromise: QueryPromise<TData>;
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

  getParams(): TParams {
    return this.params;
  }

  constructor(
    queryDefinition: QD,
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
    return {
      status: this.currentPromise.status,
      data: this.currentPromise.value,
      error: this.currentPromise.reason,
      dataUpdatedAt: this.currentPromise.dataUpdatedAt,
      errorUpdatedAt: this.currentPromise.errorUpdatedAt,
      fetchStatus: this.currentPromise.fetchStatus,
    };
  }

  /**
   * Get the query definition and parameters
   */
  getKey(): { definition: QD; params: TParams } {
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
    if (this.prefetchedAt != null) {
      return false;
    }

    // If staleTime is 'static', data is never stale (even if never fetched or invalidated)
    if (this.staleTime === "static" || this.staleTime === Infinity) {
      return false;
    }

    const state = this.getState();

    // If no data has been fetched yet (or was invalidated), it's stale
    if (state.dataUpdatedAt == null) {
      return true;
    }

    // staleTime can't be less than 1, so we set it to 1 if it's undefined or 0.
    const now = Date.now();

    return now >= state.dataUpdatedAt + this.staleTime;
  }

  /**
   * Fetch query data using the queryFn with retry logic
   *
   * @returns Promise that resolves with the query data
   */
  private createFetcher(): QueryPromise<TData> {
    // If already fetching, return the current promise
    if (
      this.currentPromise != null &&
      this.currentPromise.fetchStatus === "fetching"
    ) {
      return this.currentPromise;
    }

    // Create new promise with retrier (before notifying to ensure deduplication)
    const promise = this.retrier
      .execute(({ signal }) => {
        this.notifySubscribers();

        const ctx: QueryFnContext = { ...this.environment.context, signal };

        // Call queryFn with params from definition
        return this.queryDefinition.config.queryFn(this.params, ctx);
      }, QueryPromise)
      .finally(() => {
        this.notifySubscribers();
        this.scheduleGC();
      }) as QueryPromise<TData>;

    return promise;
  }

  /**
   * Execute the query
   * @param parentSpan - Optional parent span for tracing
   * @returns Promise that resolves with the query data
   */
  async fetch(parentSpan?: Span): Promise<TData> {
    const span = parentSpan
      ? parentSpan.child("query:fetch", { key: this.serializedKey })
      : tracer.startSpan("query:fetch", { key: this.serializedKey });

    try {
      this.retrier.resume();
      const data = await this.currentPromise;
      this.retrier.pause();

      span.success();
      return data;
    } catch (error) {
      span.error(error);
      throw error;
    }
  }

  prefetch(): void {
    if (
      this.currentPromise.value != null ||
      this.currentPromise.fetchStatus === "fetching"
    ) {
      // Already have data or fetching - emit success immediately
      const span = tracer.startSpan("query:prefetch", {
        key: this.serializedKey,
      });
      span.success();
      return;
    }

    const now = Date.now();
    this.prefetchedAt = now;

    const span = tracer.startSpan("query:prefetch", {
      key: this.serializedKey,
    });

    void this.fetch(span)
      .then(() => {
        span.success();

        this.timerWheel.schedule(() => {
          this.prefetchedAt = undefined;

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
        span.error(error);
      });
  }

  async enshureData(): Promise<TData> {
    if (this.currentPromise.value != null) {
      if (this.isStale()) {
        return this.fetch();
      }

      return this.currentPromise.value;
    }

    if (this.currentPromise.fetchStatus === "fetching") {
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

    if (this.currentPromise.status === "pending") {
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
      if (isStale && this.currentPromise.status === "fulfilled") {
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
    // If the query is prefetched, it's not eligible for garbage collection (for a couple of seconds)
    // this is to avoid double fetching the query after it was prefetched but not used yet.
    if (this.prefetchedAt != null) {
      return false;
    }

    // Has subscribers, not eligible
    if (this.subscribers.size > 0) {
      return false;
    }

    return this.gcTime !== Infinity;
  }

  /**
   * Invalidate the query by resetting its state to pending
   * This forces a refetch on next access
   * @param parentSpan - Optional parent span for tracing
   */
  invalidate(parentSpan?: Span): Promise<TData> {
    // Only invalidate if not static
    if (this.staleTime !== "static") {
      this.currentPromise.dataUpdatedAt = undefined;

      // If there are subscribers, trigger a refetch
      if (this.subscribers.size > 0) {
        // Reset retrier to allow new execution (cancel sets cancelled=true)
        this.retrier.reset();
        this.retrier.resume();
        this.currentPromise = this.createFetcher();

        return this.fetch(parentSpan);
      }
    }

    return this.currentPromise;
  }

  /**
   * Reset the query to its initial state
   */
  reset(): void {
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
