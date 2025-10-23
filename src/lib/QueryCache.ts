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
  /** The promise to cache */
  promise: Promise<PromiseValue>;
  /** Time in milliseconds after which the cache entry will be removed. Default: Infinity */
  gcTime?: number;
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

  constructor(options: QueryCacheOptions = {}) {
    this.cache = new Map<string, CacheEntry>();
    this.debugger = new QueryCacheDebugger(options.debug);

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
   * returns the existing promise.
   *
   * @param options - Options containing key, promise, and optional gcTime
   * @returns The cached promise entry
   */
  addPromise<const Key extends Array<unknown>, PromiseValue extends unknown>(
    options: AddPromiseOptions<Key, PromiseValue>
  ): PromiseEntry<PromiseValue> {
    const { key, promise, gcTime } = options;
    const keySerialized = stableKeySerialize(key);
    const existingEntry = this.cache.get(keySerialized);

    if (existingEntry != null) {
      this.debugger.logUpdate(key, existingEntry.promise);
      return existingEntry.promise as PromiseEntry<PromiseValue>;
    }

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
    };

    this.cache.set(keySerialized, entry);
    this.debugger.logAdd(key, promiseEntry);
    return promiseEntry as PromiseEntry<PromiseValue>;
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
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.debugger.logDelete([], "cache cleared");
  }

  /**
   * Subscribe to a cache entry. Increments the subscription count and
   * clears the GC eligibility timestamp.
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
    }
  }

  /**
   * Unsubscribe from a cache entry. Decrements the subscription count and
   * marks the entry as eligible for GC if there are no more active subscriptions.
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
   * @param key - The cache key prefix to invalidate
   */
  invalidate<const Key extends Array<unknown>>(key: Key): void {
    const keysToDelete: string[] = [];

    // Find all cache keys that start with the specified key prefix
    for (const cacheKey of this.cache.keys()) {
      if (this.keyStartsWith(cacheKey, key)) {
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
