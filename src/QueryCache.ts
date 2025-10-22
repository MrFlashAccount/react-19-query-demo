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
 * Cache entry with promise and garbage collection timeout
 */
interface CacheEntry {
  promise: Promise<unknown>;
  timeoutId?: ReturnType<typeof setTimeout>;
  /** Number of active subscriptions to this cache entry */
  subscriptions: number;
  /** GC time in milliseconds */
  gcTime?: number;
}

/**
 * QueryCache class that manages promise caching with garbage collection.
 *
 * Features:
 * - Caches promises by key
 * - Tracks active subscriptions per cache entry
 * - Only triggers GC when there are no active subscriptions
 * - Cancels GC timer when new subscriptions are added
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

  constructor() {
    this.cache = new Map<string, CacheEntry>();
  }

  /**
   * Get the underlying cache map (exposed for testing)
   */
  getCache(): Map<string, CacheEntry> {
    return this.cache;
  }

  /**
   * Start garbage collection timer for a cache entry
   */
  private startGCTimer(keySerialized: string, entry: CacheEntry): void {
    if (entry.gcTime != null && entry.gcTime < Infinity) {
      // Clear existing timer if any
      if (entry.timeoutId != null) {
        clearTimeout(entry.timeoutId);
      }

      entry.timeoutId = setTimeout(() => {
        const currentEntry = this.cache.get(keySerialized);
        if (currentEntry === entry && currentEntry.subscriptions === 0) {
          this.cache.delete(keySerialized);
        }
      }, entry.gcTime);
    }
  }

  /**
   * Add a promise to the cache. If a promise with the same key already exists,
   * returns the existing promise.
   *
   * @param options - Options containing key, promise, and optional gcTime
   * @returns The cached promise
   */
  addPromise<const Key extends Array<unknown>, PromiseValue extends unknown>(
    options: AddPromiseOptions<Key, PromiseValue>
  ): Promise<PromiseValue> {
    const { key, promise, gcTime } = options;
    const keySerialized = stableKeySerialize(key);
    const existingEntry = this.cache.get(keySerialized);

    if (existingEntry != null) {
      return existingEntry.promise as Promise<PromiseValue>;
    }

    const entry: CacheEntry = {
      promise,
      subscriptions: 0,
      gcTime,
    };

    this.cache.set(keySerialized, entry);
    return promise;
  }

  /**
   * Get a promise from the cache by key
   *
   * @param key - The cache key
   * @returns The cached promise or null if not found
   */
  getPromise<const Key extends Array<unknown>, PromiseValue extends unknown>(
    key: Key
  ): Promise<PromiseValue> | null {
    const keySerialized = stableKeySerialize(key);
    const entry = this.cache.get(keySerialized);

    return (entry?.promise as Promise<PromiseValue>) ?? null;
  }

  /**
   * Subscribe to a cache entry. Increments the subscription count and
   * cancels any pending GC timer.
   *
   * @param key - The cache key to subscribe to
   */
  subscribe<const Key extends Array<unknown>>(key: Key): void {
    const keySerialized = stableKeySerialize(key);
    const entry = this.cache.get(keySerialized);

    if (entry != null) {
      entry.subscriptions++;

      // Clear GC timer when there are active subscriptions
      if (entry.timeoutId != null) {
        clearTimeout(entry.timeoutId);
        entry.timeoutId = undefined;
      }
    }
  }

  /**
   * Unsubscribe from a cache entry. Decrements the subscription count and
   * starts the GC timer if there are no more active subscriptions.
   *
   * @param key - The cache key to unsubscribe from
   */
  unsubscribe<const Key extends Array<unknown>>(key: Key): void {
    const keySerialized = stableKeySerialize(key);
    const entry = this.cache.get(keySerialized);

    if (entry != null) {
      entry.subscriptions = Math.max(0, entry.subscriptions - 1);

      // Start GC timer when no active subscriptions
      if (entry.subscriptions === 0) {
        this.startGCTimer(keySerialized, entry);
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
      const entry = this.cache.get(keyToDelete);
      if (entry != null) {
        if (entry.timeoutId != null) {
          clearTimeout(entry.timeoutId);
        }
        this.cache.delete(keyToDelete);
      }
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
