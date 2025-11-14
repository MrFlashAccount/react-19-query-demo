import {
  GarbageCollector,
  type GarbageCollectorOptions,
} from "./GarbageCollector";
import type { RetryConfig } from "./Retrier";
import {
  Query,
  stableKeySerialize,
  type AnyKey,
  type QueryOptions,
} from "./Query";

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
  private garbageCollector: GarbageCollector;
  private onChange?: (newInstance: QueryClient) => void;
  private gcOptions?: GarbageCollectorOptions;

  constructor(options: QueryClientOptions = {}) {
    // Store options for cloning
    this.gcOptions = options.gc;

    this._cache = options.cache || new Map<string, Query<AnyKey, unknown>>();

    // Create garbage collector with callback to log deletions
    this.garbageCollector = new GarbageCollector(options.gc);

    this.onChange = options.onChange;

    for (const [serializedKey, query] of this._cache.entries()) {
      query.setGarbageCollectCallback(() =>
        this.handleQueryGarbageCollect(serializedKey)
      );
    }
  }

  /**
   * Create a new QueryClient instance with the same cache and state.
   * Used internally when cache mutations occur.
   */
  private clone(): QueryClient {
    const newInstance = new QueryClient({
      gc: this.gcOptions,
      cache: this._cache, // Reuse same cache reference
      onChange: this.onChange,
    });

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
   * Get the debugger instance
   */
  getGarbageCollector(): GarbageCollector {
    return this.garbageCollector;
  }

  /**
   * Get the underlying cache map (exposed for testing)
   */
  getCache(): ReadonlyMap<string, Query<AnyKey, unknown>> {
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
    const existingQuery = this._cache.get(keySerialized) as
      | Query<Key, PromiseValue>
      | undefined;

    console.log("existingQuery", existingQuery);

    if (existingQuery != null) {
      return existingQuery;
    }

    const entry = new Query<Key, PromiseValue>(
      {
        key,
        queryFn,
        gcTime,
        staleTime,
        retry,
        retryDelay,
      },
      {},
      {
        onGarbageCollect: () => this.handleQueryGarbageCollect(keySerialized),
        onRemove: () => this._cache.delete(keySerialized),
      }
    );
    entry.setGarbageCollectCallback(() =>
      this.handleQueryGarbageCollect(keySerialized)
    );

    console.log("entry", entry);

    this._cache.set(keySerialized, entry as unknown as Query<AnyKey, unknown>);

    entry.fetchQuery();

    return entry;
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
    for (const query of this._cache.values()) {
      query.setGarbageCollectCallback(undefined);
      query.destroy();
    }
    this._cache.clear();

    // Create new instance after cache modification
    const newInstance = this.clone();
    this.notifyChange(newInstance);
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
      let removed = false;
      for (const keyToDelete of keysToDelete) {
        removed = this.deleteQuery(keyToDelete) || removed;
      }

      if (!removed) {
        return;
      }

      // Create new instance after cache modification
      const newInstance = this.clone();
      this.notifyChange(newInstance);
    }
  }

  private handleQueryGarbageCollect(serializedKey: string): void {
    if (this.deleteQuery(serializedKey)) {
      const newInstance = this.clone();
      this.notifyChange(newInstance);
    }
  }

  private deleteQuery(serializedKey: string): boolean {
    const query = this._cache.get(serializedKey);
    if (query == null) {
      return false;
    }

    query.setGarbageCollectCallback(undefined);
    query.destroy();
    this._cache.delete(serializedKey);

    return true;
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
