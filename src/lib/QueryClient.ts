import {
  QueryCacheDebugger,
  type QueryCacheDebuggerOptions,
} from "./QueryCacheDebugger";
import { PromiseEntryFactory, type PromiseEntry } from "./PromiseEntry";
import {
  GarbageCollector,
  type CacheEntry,
  type GarbageCollectorOptions,
} from "./GarbageCollector";
import { Retrier, type RetryConfig } from "./Retrier";
import type { BackgroundRefetch } from "./BackgroundRefetch";
import {
  Query,
  stableKeySerialize,
  type AnyKey,
  type QueryOptions,
} from "./Query";

// Re-export PromiseEntry for convenience
export type { PromiseEntry } from "./PromiseEntry";

/**
 * Options for adding a promise to the cache
 */
export interface AddPromiseOptions<
  Key extends Array<unknown>,
  PromiseValue extends unknown
> {
  /** The cache key */
  key: Key;
  /** Function that returns a promise to fetch data (preferred) */
  queryFn: (key: Key) => Promise<PromiseValue>;
  /** The promise to cache (deprecated, use queryFn instead) */
  promise?: Promise<PromiseValue>;
  /** Time in milliseconds after which the cache entry will be removed. Default: Infinity */
  gcTime?: number;
  /** Time in milliseconds until data becomes stale. Can be 'static' to never refetch. Default: 0 */
  staleTime?: number | "static";
  /** Retry configuration - number of retries, boolean, or custom function. Default: true (3 retries) */
  retry?: RetryConfig;
  /** Delay between retries in milliseconds. Default: 0 */
  retryDelay?: number | ((failureCount: number, error: unknown) => number);
}

/**
 * Options for QueryClient
 *  constructor
 */
export interface QueryClientOptions {
  /** Debugger configuration */
  debug?: QueryCacheDebuggerOptions;
  /** Garbage collector configuration */
  gc?: GarbageCollectorOptions;
  /** Cache implementation */
  cache?: Map<string, Query<AnyKey, unknown>>;
  /** Callback invoked when a new instance is created after cache mutation */
  onChange?: (newInstance: QueryClient) => void;
}

export interface ICache {
  has<Key extends AnyKey>(key: Key): boolean;
  get<Key extends AnyKey>(key: Key): Query<Key, unknown> | undefined;
  set<Key extends AnyKey, TData = unknown>(
    key: Key,
    value: Query<Key, TData>
  ): void;
  delete<Key extends AnyKey>(key: Key): boolean;
  clear(): void;
  keys(): IterableIterator<AnyKey>;
  values(): IterableIterator<Query<AnyKey, unknown>>;
  entries(): IterableIterator<[AnyKey, Query<AnyKey, unknown>]>;
}

/**
 * QueryClient
 *  class that manages promise caching with garbage collection.
 *
 * Features:
 * - Caches promises by key
 * - Tracks active subscriptions per cache entry
 * - Only triggers GC when there are no active subscriptions
 * - Uses idle-based scheduler to check for expired entries every 100ms
 * - Supports prefix-based query invalidation
 *
 * @example
 * ```tsx
 * const cache = new QueryClient
 * ()
 *
 * // Add promises to cache
 * cache.addPromise({
 *   key: ['user', 1],
 *   promise: fetchUser(1),
 *   gcTime: 5000
 * })
 *
 * cache.addPromise({
 *   key: ['user', 1, 'posts'],
 *   promise: fetchUserPosts(1),
 *   gcTime: 5000
 * })
 *
 * // Invalidate all queries for user 1 (including posts)
 * cache.invalidate(['user', 1])
 * ```
 */
export class QueryClient {
  private _cache: Map<string, Query<AnyKey, unknown>>;
  private debugger: QueryCacheDebugger;
  private garbageCollector: GarbageCollector;
  private backgroundRefetch?: BackgroundRefetch;
  private queryRegistry: Map<
    string,
    {
      queryFn: (key: Array<unknown>) => Promise<unknown>;
      options: {
        gcTime?: number;
        staleTime?: number | "static";
        retry?: RetryConfig;
        retryDelay?:
          | number
          | ((failureCount: number, error: unknown) => number);
      };
    }
  >;
  private onChange?: (newInstance: QueryClient) => void;
  private debugOptions?: QueryCacheDebuggerOptions;
  private gcOptions?: GarbageCollectorOptions;

  constructor(options: QueryClientOptions = {}) {
    // Store options for cloning
    this.debugOptions = options.debug;
    this.gcOptions = options.gc;

    this._cache = options.cache || new Map<string, Query<AnyKey, unknown>>();
    this.debugger = new QueryCacheDebugger(options.debug);

    // Create garbage collector with callback to log deletions
    this.garbageCollector = new GarbageCollector(options.gc);

    this.queryRegistry = new Map();
    this.onChange = options.onChange;
  }

  /**
   * Create a new QueryClient instance with the same cache and state.
   * Used internally when cache mutations occur.
   */
  private clone(): QueryClient {
    const newInstance = new QueryClient({
      debug: this.debugOptions,
      gc: this.gcOptions,
      cache: this._cache, // Reuse same cache reference
      onChange: this.onChange,
    });

    // Copy queryRegistry (shallow copy of Map)
    newInstance.queryRegistry = new Map(this.queryRegistry);

    // Copy backgroundRefetch reference
    newInstance.backgroundRefetch = this.backgroundRefetch;

    return newInstance;
  }

  /**
   * Notify onChange callback if set
   * Uses setTimeout to defer notification until after render
   */
  private notifyChange(newInstance: QueryClient): void {
    if (this.onChange) {
      // Defer notification to avoid state updates during render
      setTimeout(() => {
        this.onChange!(newInstance);
      }, 0);
    }
  }

  /**
   * Set the BackgroundRefetch instance for this cache
   * This should be called by QueryProvider after creating the BackgroundRefetch
   */
  setBackgroundRefetch(backgroundRefetch: BackgroundRefetch): void {
    this.backgroundRefetch = backgroundRefetch;
  }

  /**
   * Get the debugger instance
   */
  getDebugger(): QueryCacheDebugger {
    return this.debugger;
  }

  /**
   * Get the garbage collector instance
   */
  getGarbageCollector(): GarbageCollector {
    return this.garbageCollector;
  }

  /**
   * Get the underlying cache map (exposed for testing)
   */
  getCache() {
    return this._cache;
  }

  /**
   * Add a promise to the cache. If a promise with the same key already exists,
   * checks if it's stale and optionally refetches.
   *
   * @param options - Options containing key, queryFn (or promise for backwards compat), and optional gcTime/staleTime/retry
   * @returns The cached promise entry
   */
  addQuery<const Key extends Array<unknown>, PromiseValue extends unknown>(
    options: QueryOptions<Key, PromiseValue>
  ): Query<Key, PromiseValue> {
    const { key, queryFn, gcTime, staleTime, retry, retryDelay } = options;
    const keySerialized = Query.getSerializedKey(key);
    const existingQuery = this._cache.get(keySerialized);

    // If entry exists, return it in most cases (don't create new promises unnecessarily)
    if (existingQuery != null) {
      return existingQuery;
    }

    // Store query info in registry for background refetching
    // (only when creating a new entry or refetching)
    this.queryRegistry.set(keySerialized, {
      queryFn: queryFn as (key: Array<unknown>) => Promise<unknown>,
      options: { gcTime, staleTime, retry, retryDelay },
    });

    const entry = new Query<Key, PromiseValue>({
      key,
      queryFn,
      gcTime,
      staleTime,
      retry,
      retryDelay,
    });

    this._cache.set(keySerialized, entry);

    entry.fetchQuery();

    return entry;
  }

  /**
   * Trigger a background refetch for a query.
   * This creates a new promise and replaces the cache entry,
   * but should only be called when the data is stale and fulfilled.
   *
   * @param key - The cache key
   * @param queryFn - Function to fetch data
   * @param options - Optional gcTime, staleTime, retry, retryDelay
   */
  refetchInBackground<
    const Key extends Array<unknown>,
    PromiseValue extends unknown
  >(
    key: Key,
    queryFn: (key: Key) => Promise<PromiseValue>,
    options: {
      gcTime?: number;
      staleTime?: number | "static";
      retry?: RetryConfig;
      retryDelay?: number | ((failureCount: number, error: unknown) => number);
    }
  ): void {
    const { gcTime, staleTime, retry, retryDelay } = options;
    const keySerialized = stableKeySerialize(key);
    const existingEntry = this._cache.get(keySerialized);

    // Only refetch if there's an existing fulfilled entry
    if (
      existingEntry == null ||
      existingEntry.getState().status !== "success"
    ) {
      return;
    }

    // Store/update query info in registry
    this.queryRegistry.set(keySerialized, {
      queryFn: queryFn as (key: Array<unknown>) => Promise<unknown>,
      options: { gcTime, staleTime, retry, retryDelay },
    });

    // Create new promise with retrier
    const retrier = new Retrier({ retry, retryDelay });
    const promise = new Promise<PromiseValue>((res, rej) =>
      retrier
        .execute(() => queryFn(key))
        .then(res)
        .catch(rej)
    );

    // Preserve subscriptions from the old entry
    const entry = new Query<Key, PromiseValue>({
      key,
      queryFn,
      gcTime,
      staleTime,
      retry,
      retryDelay,
    });

    // Update the cache with the new promise
    this._cache.set(keySerialized, entry);

    // Create new instance after cache modification
    const newInstance = this.clone();
    this.notifyChange(newInstance);

    entry.fetchQuery();
  }

  /**
   * Get a promise from the cache by key
   *
   * @param key - The cache key
   * @returns The cached promise entry or null if not found
   */
  getPromise<const Key extends Array<unknown>, PromiseValue extends unknown>(
    key: Key
  ): Promise<PromiseValue> | null {
    const keySerialized = stableKeySerialize(key);
    const entry = this._cache.get(keySerialized);

    if (entry == null) {
      return null;
    }

    return entry.promise as Promise<PromiseValue> | null;
  }

  /**
   * Check if a key exists in the cache
   *
   * @param key - The cache key to check
   * @returns True if the key exists in the cache
   */
  has<const Key extends Array<unknown>>(key: Key): boolean {
    const keySerialized = stableKeySerialize(key);
    return this._cache.has(keySerialized);
  }

  /**
   * Check if cached data is stale based on staleTime
   *
   * @param key - The cache key to check
   * @returns True if the data is stale and should be refetched
   */
  isStale<const Key extends Array<unknown>>(key: Key): boolean {
    const keySerialized = stableKeySerialize(key);
    const entry = this._cache.get(keySerialized);

    if (entry == null) {
      return true;
    }

    return entry.isStale();
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this._cache.clear();
    this.debugger.logDelete([], "cache cleared");

    // Create new instance after cache modification
    const newInstance = this.clone();
    this.notifyChange(newInstance);
  }

  /**
   * Subscribe to a cache entry. Increments the subscription count and
   * clears the GC eligibility timestamp. Also registers the query for
   * background refetching if BackgroundRefetch is available.
   *
   * If the cached data is stale and fulfilled, triggers an immediate
   * background refetch to update the data (only on the first subscription
   * to avoid duplicate refetches).
   *
   * @param key - The cache key to subscribe to
   */
  subscribe<const Key extends Array<unknown>>(key: Key): void {
    const keySerialized = stableKeySerialize(key);
    const entry = this._cache.get(keySerialized);

    if (entry != null) {
      const wasFirstSubscription = entry.subscriptions === 0;
      entry.subscriptions++;

      // Clear GC eligibility when there are active subscriptions
      this.garbageCollector.clearEligibility(keySerialized);

      // Register for background refetching if BackgroundRefetch is available
      const queryInfo = this.queryRegistry.get(keySerialized);
      if (this.backgroundRefetch != null && queryInfo != null) {
        this.backgroundRefetch.register(
          key,
          queryInfo.queryFn,
          queryInfo.options
        );

        // If data is stale and fulfilled, trigger immediate background refetch
        // Only trigger on the first subscription to avoid duplicate fetches
        if (
          wasFirstSubscription &&
          this.isStale(key) &&
          entry.promise.isFulfilled
        ) {
          this.backgroundRefetch.refetchQuery(key);
        }
      }
    }
  }

  /**
   * Unsubscribe from a cache entry. Decrements the subscription count and
   * marks the entry as eligible for GC if there are no more active subscriptions.
   * Also unregisters the query from background refetching when no subscriptions remain.
   *
   * @param key - The cache key to unsubscribe from
   */
  unsubscribe<const Key extends Array<unknown>>(key: Key): void {
    const keySerialized = stableKeySerialize(key);
    const entry = this._cache.get(keySerialized);

    if (entry != null) {
      entry.subscriptions = Math.max(0, entry.subscriptions - 1);

      // Mark as eligible for GC when no active subscriptions
      if (entry.subscriptions === 0) {
        this.garbageCollector.markEligible(keySerialized);

        // Unregister from background refetching when no subscriptions remain
        if (this.backgroundRefetch != null) {
          this.backgroundRefetch.unregister(key);
        }
      }
    }
  }

  /**
   * Invalidate cache entries by key prefix. Removes entries from the cache
   * that start with the specified key, forcing them to be refetched on next access.
   *
   * Supports partial key matching:
   * - `['movies']` invalidates `['movies']`, `['movies', 'action']`, `['movies', 'search', 'query']`, etc.
   * - `['movies', 'action']` invalidates `['movies', 'action']` and `['movies', 'action', 'popular']`, etc.
   *
   * Note: Entries with staleTime='static' are never invalidated.
   *
   * @param key - The cache key prefix to invalidate
   */
  invalidate<const Key extends Array<unknown>>(key: Key): void {
    const keysToDelete: string[] = [];

    // Find all cache keys that start with the specified key prefix
    for (const cacheKey of this._cache.keys()) {
      if (this.keyStartsWith(cacheKey, key)) {
        const entry = this._cache.get(cacheKey);

        // Skip entries with staleTime='static'
        if (entry != null && entry.getOptions().staleTime === "static") {
          continue;
        }

        keysToDelete.push(cacheKey);
      }
    }

    // Delete all matching entries
    if (keysToDelete.length > 0) {
      for (const keyToDelete of keysToDelete) {
        const parsedKey = JSON.parse(keyToDelete) as Array<unknown>;
        this.debugger.logDelete(parsedKey, "invalidated");
        this._cache.delete(keyToDelete);
      }

      // Create new instance after cache modification
      const newInstance = this.clone();
      this.notifyChange(newInstance);
    }
  }

  /**
   * Check if a serialized cache key starts with the specified key prefix
   *
   * @param serializedKey - The serialized cache key (JSON string)
   * @param keyPrefix - The key prefix to check against
   * @returns True if the cache key starts with the prefix
   */
  private keyStartsWith<const Key extends Array<unknown>>(
    serializedKey: string,
    keyPrefix: Key
  ): boolean {
    const parsedKey = JSON.parse(serializedKey) as Array<unknown>;

    // Check if parsedKey starts with all elements of keyPrefix
    if (parsedKey.length < keyPrefix.length) {
      return false;
    }

    for (let i = 0; i < keyPrefix.length; i++) {
      if (JSON.stringify(parsedKey[i]) !== JSON.stringify(keyPrefix[i])) {
        return false;
      }
    }

    return true;
  }
}
