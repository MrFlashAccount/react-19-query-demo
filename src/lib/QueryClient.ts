import { Query } from "./Query";
import { noop } from "./utils";
import { eventEmitter } from "./EventEmitter";
import {
  type QueryDefinition,
  type DependencyGraph,
  getQueryInstanceKey,
} from "./DependencyGraph";
import { QueryCache } from "./QueryCache";

/**
 * Options for QueryClient constructor
 */
export interface QueryClientOptions {
  /** Dependency graph containing all query and mutation definitions (required) */
  graph: DependencyGraph;
  /** Cache implementation */
  cache?: QueryCache;
  /** Callback invoked when a new instance is created after cache mutation */
  onChange?: (newInstance: QueryClient) => void;
  context?: QueryClientContext;
}

export interface QueryClientContext extends Record<string, unknown> {}

export interface InvalidateOptions {
  parentScopeId?: string;
}

/**
 * QueryClient manages query instances based on definitions from a dependency graph.
 *
 * Features:
 * - Caches query instances by definition + params
 * - Tracks active subscriptions per cache entry
 * - Only triggers GC when there are no active subscriptions
 * - Supports definition-level and instance-level invalidation
 * - Uses dependency graph for managing relationships
 *
 * @example
 * ```tsx
 * const moviesQuery = query({
 *   queryFn: (params: { page: number }) => fetchMovies(params.page)
 * });
 *
 * const graph = new DependencyGraph([moviesQuery]);
 * const client = new QueryClient({ graph });
 *
 * // Add query instance to cache
 * const queryInstance = client.addQuery(moviesQuery, { page: 1 });
 *
 * // Invalidate all instances of moviesQuery
 * await client.invalidateQuery(moviesQuery);
 *
 * // Invalidate specific instance
 * await client.invalidateQueryInstance(moviesQuery, { page: 1 });
 * ```
 */
export class QueryClient {
  private _cache: QueryCache;
  private graph: DependencyGraph;
  private onChange: (newInstance: QueryClient) => void;
  private context: QueryClientContext;

  constructor(options: QueryClientOptions) {
    this.graph = options.graph;
    this._cache = options.cache || new QueryCache();
    this.onChange = options.onChange ?? noop;
    this.context = options.context ?? {};
  }

  setOptions(options: Partial<QueryClientOptions>): void {
    if (options.graph !== undefined) {
      this.graph = options.graph;
    }

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
      graph: this.graph,
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
   * Get the underlying cache (exposed for testing)
   */
  getCache(): Readonly<QueryCache> {
    return this._cache;
  }

  /**
   * Add a query instance to the cache. If an instance with the same definition + params
   * already exists, returns the existing instance.
   *
   * @param queryDefinition - The query definition from the dependency graph
   * @param params - The parameters for this query instance
   * @param options - Optional configuration
   * @returns The cached query instance
   */
  addQuery<TData, TParams>(
    queryDefinition: QueryDefinition<TData, TParams>,
    params: TParams,
    options?: {
      prefetch?: boolean;
    }
  ): Query<TData, TParams> {
    const existingQuery = this._cache.get(queryDefinition, params) as
      | Query<TData, TParams>
      | undefined;

    if (existingQuery != null) {
      return existingQuery;
    }

    const entry = new Query<TData, TParams>(queryDefinition, params, {
      onRemove: () => {
        const instanceKey = getQueryInstanceKey(params);
        eventEmitter.emit("query:garbage-collect", {
          key: instanceKey,
        });
        this.handleQueryGarbageCollect(queryDefinition, params);
      },
    });

    this._cache.set(queryDefinition, params, entry);

    if (options?.prefetch) {
      entry.prefetch();
    }

    return entry;
  }

  /**
   * Get a query instance if it exists in the cache
   *
   * @param queryDefinition - The query definition
   * @param params - The query parameters
   * @returns The cached query instance or undefined
   */
  getQuery<TData, TParams>(
    queryDefinition: QueryDefinition<TData, TParams>,
    params: TParams
  ): Query<TData, TParams> | undefined {
    return this._cache.get(queryDefinition, params) as
      | Query<TData, TParams>
      | undefined;
  }

  /**
   * Check if a query instance exists in the cache
   *
   * @param queryDefinition - The query definition
   * @param params - The query parameters
   * @returns True if the query instance exists
   */
  hasQuery<TParams>(
    queryDefinition: QueryDefinition,
    params: TParams
  ): boolean {
    return this._cache.has(queryDefinition, params);
  }

  /**
   * Check if a query instance is stale
   *
   * @param queryDefinition - The query definition
   * @param params - The query parameters
   * @returns True if the query is stale or doesn't exist
   */
  isStale<TParams>(queryDefinition: QueryDefinition, params: TParams): boolean {
    const entry = this._cache.get(queryDefinition, params);

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
   * Invalidate all instances of a query definition, forcing them to refetch on next access.
   *
   * Note: Queries with staleTime='static' are never invalidated.
   *
   * @param queryDefinition - The query definition to invalidate
   * @param options - Optional invalidation options
   */
  async invalidateQuery(
    queryDefinition: QueryDefinition,
    options: InvalidateOptions = {}
  ): Promise<void> {
    // Find all cache entries for this query definition
    const queries = this._cache.findByDefinition(queryDefinition);

    for (const query of queries) {
      await query.invalidate(options.parentScopeId);
    }

    const newInstance = this.clone();
    this.notifyChange(newInstance);
  }

  /**
   * Invalidate a specific query instance by definition + params.
   *
   * @param queryDefinition - The query definition
   * @param params - The query parameters
   * @param options - Optional invalidation options
   */
  async invalidateQueryInstance<TParams>(
    queryDefinition: QueryDefinition,
    params: TParams,
    options: InvalidateOptions = {}
  ): Promise<void> {
    const query = this._cache.get(queryDefinition, params);

    if (query) {
      await query.invalidate(options.parentScopeId);
      const newInstance = this.clone();
      this.notifyChange(newInstance);
    }
  }

  private handleQueryGarbageCollect<TData, TParams>(
    queryDefinition: QueryDefinition<TData, TParams>,
    params: TParams
  ): void {
    if (this.deleteQuery(queryDefinition, params)) {
      const newInstance = this.clone();
      this.notifyChange(newInstance);
    }
  }

  private deleteQuery<TData, TParams>(
    queryDefinition: QueryDefinition<TData, TParams>,
    params: TParams
  ): boolean {
    const query = this._cache.get(queryDefinition, params);
    if (query == null) {
      return false;
    }

    query.destroy();
    this._cache.delete(queryDefinition, params);

    return true;
  }

  /**
   * Get the dependency graph
   */
  getGraph(): DependencyGraph {
    return this.graph;
  }
}
