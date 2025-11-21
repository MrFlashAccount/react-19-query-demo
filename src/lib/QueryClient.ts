import type { RetryConfig } from "./Retrier";
import { Query, type AnyKey, type QueryOptions } from "./Query";
import { noop } from "./utils";
import { eventEmitter } from "./EventEmitter";
import { QueryKeyTree } from "./QueryKeyTree";

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
  /** Cache implementation */
  cache?: QueryKeyTree;
  /** Callback invoked when a new instance is created after cache mutation */
  onChange?: (newInstance: QueryClient) => void;
  context?: QueryClientContext;
}

export interface QueryClientContext extends Record<string, unknown> {}

export interface InvalidateOptions {
  parentScopeId?: string;
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
  private _cache: QueryKeyTree;
  private onChange: (newInstance: QueryClient) => void;
  private context: QueryClientContext;

  constructor(options: QueryClientOptions = {}) {
    this._cache = options.cache || new QueryKeyTree();
    this.onChange = options.onChange ?? noop;
    this.context = options.context ?? {};
  }

  setOptions(options: QueryClientOptions): void {
    if (options.cache !== undefined) {
      this._cache = options.cache;
    }

    if (options.onChange !== undefined) {
      this.onChange = options.onChange;
    }

    if (options.context?.measure !== undefined) {
      this.context.measure = options.context.measure;
    }
  }

  /**
   * Create a new QueryClient instance with the same cache and state.
   * Used internally when cache mutations occur.
   */
  public clone(): QueryClient {
    const newInstance = new QueryClient({
      cache: this._cache, // Reuse same cache reference
      onChange: this.onChange,
      context: this.context,
    });

    return newInstance;
  }

  /**
   * Notify onChange callback if set
   */
  public notifyChange(newInstance: QueryClient): void {
    this.onChange(newInstance);
  }

  /**
   * Get the underlying cache tree (exposed for testing)
   */
  getCache(): QueryKeyTree {
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
    options: QueryOptions<Key, PromiseValue> & {
      prefetch?: boolean;
    }
  ): Query<Key, PromiseValue> {
    const { key, queryFn, gcTime, staleTime, retry, retryDelay, prefetch } =
      options;

    const existingQuery = this._cache.get(key) as
      | Query<Key, PromiseValue>
      | undefined;

    if (existingQuery != null) {
      return existingQuery;
    }

    const entry = new Query<Key, PromiseValue>(
      { key, queryFn, gcTime, staleTime, retry, retryDelay },
      {},
      {
        onRemove: () => {
          eventEmitter.emit("query:garbage-collect", {
            key: entry.serializedKey,
          });
          this.handleQueryGarbageCollect(key);
        },
      }
    );

    this._cache.set(key, entry as unknown as Query<AnyKey, unknown>);

    if (prefetch) {
      entry.prefetch();
    }

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
    const entry = this._cache.get(key);

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
    return this._cache.has(key);
  }

  /**
   * Check if cached data is stale based on staleTime
   *
   * @param key - The cache key to check
   * @returns True if the data is stale and should be refetched
   */
  isStale<const Key extends Array<unknown>>(key: Key): boolean {
    const entry = this._cache.get(key);

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
  async invalidate<const Key extends Array<unknown>>(
    key: Key,
    options: InvalidateOptions = {}
  ): Promise<void> {
    // Use tree's efficient prefix search - no need to iterate all keys!
    const queries = this._cache.findByPrefix(key);

    for (const query of queries) {
      await query.invalidate(options.parentScopeId);
    }

    const newInstance = this.clone();
    this.notifyChange(newInstance);
  }

  private handleQueryGarbageCollect<Key extends AnyKey>(key: Key): void {
    if (this.deleteQuery(key)) {
      const newInstance = this.clone();
      this.notifyChange(newInstance);
    }
  }

  private deleteQuery<Key extends AnyKey>(key: Key): boolean {
    const query = this._cache.get(key);
    if (query == null) {
      return false;
    }

    query.destroy();
    this._cache.delete(key);

    return true;
  }
}
