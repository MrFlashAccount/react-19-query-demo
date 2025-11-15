import type { IGarbageCollectable } from "./GarbageCollector";
import { Retrier, type RetryConfig } from "./Retrier";
import { timerWheel, type TimerWheel } from "./TimerWheel";
import { createBatcher, noop, type Batch } from "./utils";

/**
 * Query state tracking
 */
export interface QueryState<TData> {
  /** Current status of the query */
  status: "pending" | "success" | "error";
  /** The resolved data when query is successful */
  data?: TData;
  /** The error when query fails */
  error?: unknown;
  /** Timestamp when the data was last fetched successfully */
  dataUpdatedAt?: number;
  /** Timestamp when the error occurred */
  errorUpdatedAt?: number;
  /** Current fetch status */
  fetchStatus: "idle" | "fetching";
}

export type Key<T extends unknown> = Array<T>;
export type AnyKey = Key<unknown>;

/**
 * Options for a query
 */
export interface QueryOptions<Key extends Array<unknown>, TData> {
  /** The query key */
  key: Key;
  /** Function that returns a promise to fetch data */
  queryFn: (key: Key) => Promise<TData>;
  /** Time in milliseconds after which the query will be garbage collected. Default: Infinity */
  gcTime?: number;
  /** Time in milliseconds until data becomes stale. Can be 'static' to never refetch. Default: 0 */
  staleTime?: number | "static";
  /** Retry configuration - number of retries, boolean, or custom function. Default: true (3 retries) */
  retry?: RetryConfig;
  /** Delay between retries in milliseconds. Default: 0 */
  retryDelay?: number | ((failureCount: number, error: unknown) => number);
}

/**
 * Query class that manages an individual query's state, fetching, subscribers, and GC
 *
 * Features:
 * - Tracks query state (status, data, error)
 * - Manages subscribers with automatic refetch on subscribe if stale
 * - Handles retries using Retrier
 * - Schedules garbage collection using TimerWheel when no subscribers remain
 * - Supports custom options with defaults
 *
 * @example
 * ```typescript
 * const query = new Query(
 *   ['user', 1],
 *   { queryFn: fetchUser, gcTime: 5000, staleTime: 30000 }
 * );
 *
 * // Subscribe to changes
 * const unsubscribe = query.subscribe(() => {
 *   console.log('Query updated:', query.getState());
 * });
 *
 * // Fetch data
 * await query.fetchQuery();
 *
 * // Later...
 * unsubscribe();
 * ```
 */
interface QueryEnvironment {
  onGarbageCollect?: () => void;
  onRemove?: () => void;
}

export class Query<Key extends AnyKey, TData = unknown>
  implements IGarbageCollectable
{
  private queryKey: Key;
  private state: QueryState<TData>;
  private options: QueryOptions<Key, TData>;
  private defaultOptions: Partial<QueryOptions<Key, TData>>;
  private readonly serializedKeyValue: string;

  // Subscribers
  private subscribers: Set<() => void> = new Set();

  // GC
  private timerWheel: TimerWheel;
  private gcTimerId?: number;

  // Retrier
  private retrier: Retrier;
  private onRemove: () => void;
  private batch: Batch;

  // Promise tracking
  private currentPromise: Promise<TData> | null = null;
  private onGarbageCollect: () => void;

  static getSerializedKey(key: AnyKey): string {
    return stableKeySerialize(key);
  }

  get promise() {
    return this.currentPromise;
  }

  get subscriptions(): number {
    return this.subscribers.size;
  }

  get key(): Readonly<Key> {
    return this.queryKey;
  }

  constructor(
    options: QueryOptions<Key, TData>,
    defaultOptions: Partial<QueryOptions<Key, TData>> = {},
    environment: QueryEnvironment = {}
  ) {
    this.queryKey = options.key;
    this.defaultOptions = defaultOptions;
    this.options = this.mergeOptions(options);
    this.timerWheel = timerWheel;
    this.serializedKeyValue = Query.getSerializedKey(this.queryKey);
    this.onGarbageCollect = environment.onGarbageCollect ?? noop;

    this.onRemove = environment.onRemove ?? noop;
    this.batch = createBatcher();
    // Initialize state
    this.state = {
      status: "pending",
      fetchStatus: "idle",
      data: undefined,
      error: undefined,
      dataUpdatedAt: undefined,
      errorUpdatedAt: undefined,
    };

    // Create retrier with merged options
    this.retrier = new Retrier({
      retry: this.options.retry,
      retryDelay: this.options.retryDelay,
    });

    this.retrier.pause();
    this.fetchQuery();
  }

  /**
   * Get the current state of the query
   */
  getState(): Readonly<QueryState<TData>> {
    return this.state;
  }

  /**
   * Get the query key
   */
  getKey(): Readonly<Key> {
    return this.queryKey;
  }

  get serializedKey(): Readonly<string> {
    return this.serializedKeyValue;
  }

  /**
   * Get the query options
   */
  getOptions(): Readonly<QueryOptions<Key, TData>> {
    return this.options;
  }

  /**
   * Update query options
   */
  setOptions(options: Partial<QueryOptions<Key, TData>>): void {
    this.options = { ...this.options, ...options };

    // Update retrier if retry options changed
    if (options.retry !== undefined || options.retryDelay !== undefined) {
      this.retrier = new Retrier({
        retry: this.options.retry,
        retryDelay: this.options.retryDelay,
      });
    }
  }

  /**
   * Check if the query data is stale
   */
  isStale(): boolean {
    // If no data has been fetched yet, it's stale
    if (this.state.dataUpdatedAt == null) {
      return true;
    }

    // If staleTime is 'static', data is never stale
    if (this.options.staleTime === "static") {
      return false;
    }

    // If staleTime is Infinity, data is never stale
    if (this.options.staleTime === Infinity) {
      return false;
    }

    // staleTime can't be less than 1, so we set it to 1 if it's undefined or 0.
    const staleTime = this.options.staleTime || 1;
    const now = Date.now();

    return now >= this.state.dataUpdatedAt + staleTime;
  }

  /**
   * Fetch query data using the queryFn with retry logic
   *
   * @returns Promise that resolves with the query data
   */
  fetchQuery(): Promise<TData> {
    // If already fetching, return the current promise
    if (this.state.fetchStatus === "fetching" && this.currentPromise != null) {
      return this.currentPromise;
    }

    this.retrier.reset();

    // Create new promise with retrier (before notifying to ensure deduplication)
    this.currentPromise = this.retrier
      .execute(() => {
        console.log("fetchQuery", this.queryKey);
        // Update fetch status
        this.state.fetchStatus = "fetching";
        // Notify after promise is created to ensure deduplication works
        this.notifySubscribers();

        return this.options.queryFn(this.queryKey);
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
      });

    return this.currentPromise;
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

    this.subscribers.add(() => callback());

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
      console.log("executing batch", { isStale, status: this.state.status });
      if (isStale && this.state.status === "success") {
        console.log("fetching query", this.queryKey);
        void this.fetchQuery();
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
    this.onRemove();
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

    const gcTime = this.options.gcTime ?? Infinity;

    // Don't schedule GC if gcTime is Infinity
    if (gcTime === Infinity || this.subscribers.size > 0) {
      return;
    }

    // Schedule GC using timer wheel
    this.gcTimerId = this.timerWheel.schedule(() => {
      this.handleGC();
    }, gcTime);
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
    if (this.canBeCollected()) {
      // Clear the timer ID since it has fired
      this.gcTimerId = undefined;
      this.onGarbageCollect();
      this.remove();
    }
  }

  /**
   * Check if the query is eligible for garbage collection
   * (no subscribers and GC timer has elapsed or not scheduled)
   */
  canBeCollected(): boolean {
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
    const gcTime = this.options.gcTime ?? Infinity;
    return gcTime !== Infinity;
  }

  /**
   * Invalidate the query by resetting its state to pending
   * This forces a refetch on next access
   */
  invalidate(): void {
    // Only invalidate if not static
    this.state.dataUpdatedAt = undefined;

    // If there are subscribers, trigger a refetch
    if (this.subscribers.size > 0) {
      this.retrier.cancel();
      void this.fetchQuery();
    }
  }

  /**
   * Reset the query to its initial state
   */
  reset(): void {
    this.state = {
      status: "pending",
      fetchStatus: "idle",
    };
    this.currentPromise = null;
    this.notifySubscribers();
  }

  /**
   * Destroy the query, cleaning up resources
   */
  destroy(): void {
    this.reset();
    this.cancelGC();
    this.onGarbageCollect = noop;
    this.subscribers.clear();
    this.currentPromise = null;
  }

  refetch(): void {
    void this.fetchQuery();
  }

  private mergeOptions(
    options: Partial<QueryOptions<Key, TData>>
  ): Required<QueryOptions<Key, TData>> {
    for (const key in this.defaultOptions) {
      if (key in options) {
        continue;
      }

      // @ts-expect-error - we know that the key is a valid key of QueryOptions
      options[key] = this.defaultOptions[key];
    }

    return options as Required<QueryOptions<Key, TData>>;
  }
}

export function stableKeySerialize<Key extends Array<unknown>>(
  key: Key
): string {
  // TODO: make this stable
  return JSON.stringify(key);
}
