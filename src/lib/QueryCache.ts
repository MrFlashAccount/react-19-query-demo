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
  queryFn?: (key: Key) => Promise<PromiseValue>;
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
 * Options for QueryCache constructor
 */
export interface QueryCacheOptions {
  /** Debugger configuration */
  debug?: QueryCacheDebuggerOptions;
  /** Garbage collector configuration */
  gc?: GarbageCollectorOptions;
}

/**
 * QueryCache class that manages promise caching with garbage collection.
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
 * const cache = new QueryCache()
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
export class QueryCache {
  private cache: Map<string, CacheEntry>;
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

  constructor(options: QueryCacheOptions = {}) {
    this.cache = new Map<string, CacheEntry>();
    this.debugger = new QueryCacheDebugger(options.debug);
    this.queryRegistry = new Map();

    // Create garbage collector with callback to log deletions
    this.garbageCollector = new GarbageCollector({
      ...options.gc,
      onCollect: (key) => {
        const parsedKey = JSON.parse(key) as Array<unknown>;
        this.debugger.logDelete(parsedKey, "garbage collected");
        options.gc?.onCollect?.(key);
      },
    });

    this.garbageCollector.start(this.cache);
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
   * Stop the garbage collection scheduler
   * Used for cleanup when the cache is no longer needed
   */
  destroy(): void {
    this.garbageCollector.stop();
  }

  /**
   * Manually trigger garbage collection (useful for testing)
   * This bypasses the scheduler and immediately runs GC
   */
  triggerGarbageCollection(): void {
    this.garbageCollector.triggerCollection();
  }

  /**
   * Get the underlying cache map (exposed for testing)
   */
  getCache(): Map<string, CacheEntry> {
    return this.cache;
  }

  /**
   * Add a promise to the cache. If a promise with the same key already exists,
   * checks if it's stale and optionally refetches.
   *
   * @param options - Options containing key, queryFn (or promise for backwards compat), and optional gcTime/staleTime/retry
   * @returns The cached promise entry
   */
  addPromise<const Key extends Array<unknown>, PromiseValue extends unknown>(
    options: AddPromiseOptions<Key, PromiseValue>
  ): PromiseEntry<PromiseValue> {
    const {
      key,
      queryFn,
      promise: rawPromise,
      gcTime,
      staleTime,
      retry,
      retryDelay,
    } = options;
    const keySerialized = stableKeySerialize(key);
    const existingEntry = this.cache.get(keySerialized);

    // For backwards compatibility: if only promise is provided, use it directly
    if (queryFn == null && rawPromise != null) {
      if (existingEntry != null) {
        this.debugger.logUpdate(key, existingEntry.promise);
        return existingEntry.promise as PromiseEntry<PromiseValue>;
      }

      const promiseEntry = PromiseEntryFactory.create(rawPromise, {
        gcTime,
        key,
        onStatusChange: (oldStatus, newStatus, entry) => {
          this.debugger.logStatusChange(key, entry, oldStatus, newStatus);
        },
      });

      const entry: CacheEntry = {
        promise: promiseEntry,
        subscriptions: 0,
        gcTime,
        staleTime,
        dataUpdatedAt: undefined,
      };

      this.cache.set(keySerialized, entry);
      this.debugger.logAdd(key, promiseEntry);

      rawPromise
        .then(() => {
          const cachedEntry = this.cache.get(keySerialized);
          if (cachedEntry != null) {
            cachedEntry.dataUpdatedAt = Date.now();
          }
        })
        .catch(() => {});

      return promiseEntry as PromiseEntry<PromiseValue>;
    }

    if (queryFn == null) {
      throw new Error("Either queryFn or promise must be provided");
    }

    // Store query info in registry for background refetching
    this.queryRegistry.set(keySerialized, {
      queryFn: queryFn as (key: Array<unknown>) => Promise<unknown>,
      options: { gcTime, staleTime, retry, retryDelay },
    });

    // If entry exists and is not stale, return it
    if (existingEntry != null && !this.isStale(key)) {
      this.debugger.logUpdate(key, existingEntry.promise);
      return existingEntry.promise as PromiseEntry<PromiseValue>;
    }

    // If entry exists but is stale and fulfilled, trigger background refetch
    if (
      existingEntry != null &&
      this.isStale(key) &&
      existingEntry.promise.isFulfilled
    ) {
      // Return existing data immediately
      const existingPromise =
        existingEntry.promise as PromiseEntry<PromiseValue>;

      // Trigger background refetch
      this.refetchInBackground(key, queryFn, {
        gcTime,
        staleTime,
        retry,
        retryDelay,
      });

      return existingPromise;
    }

    // Create new entry
    const retrier = new Retrier({ retry, retryDelay });
    const promise = new Promise<PromiseValue>((res, rej) =>
      retrier
        .execute(() => queryFn(key))
        .then(res)
        .catch(rej)
    );

    // Create a PromiseEntry using the factory
    const promiseEntry = PromiseEntryFactory.create(promise, {
      gcTime,
      key,
      onStatusChange: (oldStatus, newStatus, entry) => {
        this.debugger.logStatusChange(key, entry, oldStatus, newStatus);
      },
    });

    const entry: CacheEntry = {
      promise: promiseEntry,
      subscriptions: 0,
      gcTime,
      staleTime,
      dataUpdatedAt: undefined,
    };

    this.cache.set(keySerialized, entry);
    this.debugger.logAdd(key, promiseEntry);

    // Set dataUpdatedAt when promise fulfills
    promise
      .then(() => {
        const cachedEntry = this.cache.get(keySerialized);
        if (cachedEntry != null) {
          cachedEntry.dataUpdatedAt = Date.now();
        }
      })
      .catch(() => {
        // Ignore errors - they're handled elsewhere
      });

    return promiseEntry as PromiseEntry<PromiseValue>;
  }

  /**
   * Refetch data in the background for a stale entry
   *
   * @param key - The cache key
   * @param queryFn - Function to fetch data
   * @param options - Optional gcTime, staleTime, retry, retryDelay
   */
  private refetchInBackground<
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

    // Create new promise with retrier
    const retrier = new Retrier({ retry, retryDelay });
    const promise = new Promise<PromiseValue>((res, rej) =>
      retrier
        .execute(() => queryFn(key))
        .then(res)
        .catch(rej)
    );

    // Create a PromiseEntry using the factory
    const promiseEntry = PromiseEntryFactory.create(promise, {
      gcTime,
      key,
      onStatusChange: (oldStatus, newStatus, entry) => {
        this.debugger.logStatusChange(key, entry, oldStatus, newStatus);
      },
    });

    const entry: CacheEntry = {
      promise: promiseEntry,
      subscriptions: 0,
      gcTime,
      staleTime,
      dataUpdatedAt: undefined,
    };

    // Update the cache with the new promise
    this.cache.set(keySerialized, entry);

    // Set dataUpdatedAt when promise fulfills
    promise
      .then(() => {
        const cachedEntry = this.cache.get(keySerialized);
        if (cachedEntry != null) {
          cachedEntry.dataUpdatedAt = Date.now();
        }
      })
      .catch(() => {
        // Ignore errors - they're handled elsewhere
      });
  }

  /**
   * Get a promise from the cache by key
   *
   * @param key - The cache key
   * @returns The cached promise entry or null if not found
   */
  getPromise<const Key extends Array<unknown>, PromiseValue extends unknown>(
    key: Key
  ): PromiseEntry<PromiseValue> | null {
    const keySerialized = stableKeySerialize(key);
    const entry = this.cache.get(keySerialized);

    return (entry?.promise as PromiseEntry<PromiseValue>) ?? null;
  }

  /**
   * Check if a key exists in the cache
   *
   * @param key - The cache key to check
   * @returns True if the key exists in the cache
   */
  has<const Key extends Array<unknown>>(key: Key): boolean {
    const keySerialized = stableKeySerialize(key);
    return this.cache.has(keySerialized);
  }

  /**
   * Check if cached data is stale based on staleTime
   *
   * @param key - The cache key to check
   * @returns True if the data is stale and should be refetched
   */
  isStale<const Key extends Array<unknown>>(key: Key): boolean {
    const keySerialized = stableKeySerialize(key);
    const entry = this.cache.get(keySerialized);

    if (entry == null) {
      return true;
    }

    // If staleTime is 'static', data is never stale
    if (entry.staleTime === "static") {
      return false;
    }

    // If staleTime is Infinity, data is never stale
    if (entry.staleTime === Infinity) {
      return false;
    }

    // If data hasn't been fetched yet, it's stale
    if (entry.dataUpdatedAt == null) {
      return true;
    }

    // If staleTime is 0 or undefined (default), data is always stale
    const staleTime = entry.staleTime ?? 0;
    if (staleTime === 0) {
      return true;
    }

    // Check if staleTime has elapsed since last update
    const now = Date.now();
    return now >= entry.dataUpdatedAt + staleTime;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.debugger.logDelete([], "cache cleared");
  }

  /**
   * Subscribe to a cache entry. Increments the subscription count and
   * clears the GC eligibility timestamp. Also registers the query for
   * background refetching if BackgroundRefetch is available.
   *
   * @param key - The cache key to subscribe to
   */
  subscribe<const Key extends Array<unknown>>(key: Key): void {
    const keySerialized = stableKeySerialize(key);
    const entry = this.cache.get(keySerialized);

    if (entry != null) {
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
    const entry = this.cache.get(keySerialized);

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
    for (const cacheKey of this.cache.keys()) {
      if (this.keyStartsWith(cacheKey, key)) {
        const entry = this.cache.get(cacheKey);

        // Skip entries with staleTime='static'
        if (entry != null && entry.staleTime === "static") {
          continue;
        }

        keysToDelete.push(cacheKey);
      }
    }

    // Delete all matching entries
    for (const keyToDelete of keysToDelete) {
      const parsedKey = JSON.parse(keyToDelete) as Array<unknown>;
      this.debugger.logDelete(parsedKey, "invalidated");
      this.cache.delete(keyToDelete);
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

function stableKeySerialize<Key extends Array<unknown>>(key: Key): string {
  return JSON.stringify(key);
}
