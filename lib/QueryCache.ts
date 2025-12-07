import type { Query } from "./Query";
import type {
  QueryDefinition,
  QueryParams,
  SerializedParams,
} from "./DependencyGraph";
import { serializeParams } from "./DependencyGraph";

/**
 * Query instances for a specific definition, indexed by serialized parameters
 */
type ParamMap = Map<string, Query<any, any>>;

/**
 * Unified query cache using query definitions as direct references.
 *
 * Structure: QueryDefinition → Serialized Params → Query Instance
 *
 * This eliminates the need for:
 * - Query keys (array-based)
 * - Definition indices
 * - Manual key management
 *
 * Benefits:
 * - Direct reference lookup (no index indirection)
 * - Type-safe query access through definitions
 * - Efficient invalidation by definition (all param combinations)
 * - O(1) lookup by definition + params
 * - Automatic parameter serialization
 *
 * @example
 * ```typescript
 * const cache = new QueryCache();
 *
 * // Define query
 * const moviesQuery = query({
 *   queryFn: async (params: { page: number }) => fetchMovies(params)
 * });
 *
 * // Store queries using definition reference
 * cache.set(moviesQuery, { page: 1 }, query1);
 * cache.set(moviesQuery, { page: 2 }, query2);
 *
 * // Retrieve specific query
 * const query = cache.get(moviesQuery, { page: 1 });
 *
 * // Get all instances of a query definition
 * const allMoviesQueries = cache.findByDefinition(moviesQuery);
 * ```
 */
export class QueryCache {
  /** Cache organized by query definition reference */
  private cache: Map<QueryDefinition<any, any>, ParamMap>;
  /** Total number of queries across all definitions */
  private totalSize: number = 0;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Store a query for a specific definition and parameters
   * O(1) complexity
   *
   * @param definition - The query definition reference
   * @param params - The query parameters
   * @param query - The Query instance to store
   */
  set<
    QD extends QueryDefinition<TParams, TData>,
    TParams extends unknown = unknown,
    TData extends unknown = unknown
  >(definition: QD, params: TParams, query: Query<QD, TParams, TData>): void {
    const paramsKey = serializeParams(params);

    // Get or create param map for this definition
    let paramMap = this.cache.get(definition);
    if (!paramMap) {
      paramMap = new Map();
      this.cache.set(definition, paramMap);
    }

    // Track if this is a new query
    const isNew = !paramMap.has(paramsKey);
    paramMap.set(paramsKey, query);

    if (isNew) {
      this.totalSize++;
    }
  }

  /**
   * Retrieve a query for a specific definition and parameters
   * O(1) complexity
   *
   * @param definition - The query definition reference
   * @param params - The query parameters
   * @returns The Query instance or undefined if not found
   */
  get<
    QD extends QueryDefinition<TParams, TData>,
    TParams extends unknown = unknown,
    TData extends unknown = unknown
  >(definition: QD, params: TParams): Query<QD, TParams, TData> | undefined {
    const paramsKey = serializeParams(params);
    const paramMap = this.cache.get(definition);

    return paramMap?.get(paramsKey) as Query<QD, TParams, TData>;
  }

  getRaw<
    QD extends QueryDefinition<TParams, TData>,
    TParams extends unknown = unknown,
    TData extends unknown = unknown
  >(
    definition: QD,
    serializedParams: SerializedParams
  ): Query<QD, TParams, TData> | undefined {
    const paramMap = this.cache.get(definition);
    return paramMap?.get(serializedParams) as Query<QD, TParams, TData>;
  }

  /**
   * Check if a query exists for a specific definition and parameters
   * O(1) complexity
   *
   * @param definition - The query definition
   * @param params - The query parameters
   * @returns True if the query exists
   */
  has<QD extends QueryDefinition>(
    definition: QD,
    params: QueryParams<QD>
  ): boolean {
    return this.get<QD>(definition, params) !== undefined;
  }

  /**
   * Delete a query for a specific definition and parameters
   * O(1) complexity
   *
   * @param definition - The query definition reference
   * @param params - The query parameters
   * @returns True if the query was deleted
   */
  delete<
    QD extends QueryDefinition<TParams, TData>,
    TParams extends unknown = unknown,
    TData extends unknown = unknown
  >(definition: QD, params: TParams): boolean {
    const paramsKey = serializeParams(params);
    const paramMap = this.cache.get(definition);

    if (!paramMap) {
      return false;
    }

    const deleted = paramMap.delete(paramsKey);
    if (deleted) {
      this.totalSize--;

      // Clean up empty param maps
      if (paramMap.size === 0) {
        this.cache.delete(definition);
      }
    }

    return deleted;
  }

  /**
   * Find all queries for a specific definition (all parameter combinations)
   * O(k) complexity where k is the number of parameter combinations for this definition
   *
   * @param definition - The query definition reference
   * @returns Array of all Query instances for this definition
   */
  findByDefinition<QD extends QueryDefinition>(
    definition: QD
  ): Array<Query<any, unknown>> {
    const paramMap = this.cache.get(definition);

    if (!paramMap) {
      return [];
    }

    return Array.from(paramMap.values());
  }

  /**
   * Find all queries for a set of definitions (used for batch invalidation)
   * O(sum of k_i) where k_i is parameter combinations for each definition
   *
   * @param definitions - Set of query definitions to find
   * @returns Array of all matching Query instances
   */
  findByDefinitions(
    definitions: Set<QueryDefinition<any, any>>
  ): Array<Query<any, unknown>> {
    const queries: Array<Query<any, unknown>> = [];

    for (const definition of definitions) {
      const paramMap = this.cache.get(definition);
      if (paramMap) {
        queries.push(...paramMap.values());
      }
    }

    return queries;
  }

  /**
   * Get all queries in the cache
   * O(n) complexity where n is total number of queries
   *
   * @returns Iterator of all Query instances
   */
  values(): IterableIterator<Query<any, unknown>> {
    const queries: Array<Query<any, unknown>> = [];

    for (const paramMap of this.cache.values()) {
      queries.push(...paramMap.values());
    }

    return queries.values();
  }

  /**
   * Get all [definition, serialized params, query] tuples
   * Useful for debugging and iteration
   *
   * @returns Iterator of [definition, paramsKey, query] tuples
   */
  entries(): IterableIterator<
    [QueryDefinition<any, any>, string, Query<any, unknown>]
  > {
    const entries: Array<
      [QueryDefinition<any, any>, string, Query<any, unknown>]
    > = [];

    for (const [definition, paramMap] of this.cache.entries()) {
      for (const [paramsKey, query] of paramMap.entries()) {
        entries.push([definition, paramsKey, query]);
      }
    }

    return entries.values();
  }

  /**
   * Clear all queries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
  }

  /**
   * Get the total number of queries in the cache
   */
  getSize(): number {
    return this.totalSize;
  }

  /**
   * Get the number of unique query definitions in use
   */
  getDefinitionCount(): number {
    return this.cache.size;
  }

  /**
   * Get statistics about the cache
   * Useful for monitoring and debugging
   */
  getStats(): {
    totalQueries: number;
    uniqueDefinitions: number;
    averageParamsPerDefinition: number;
    definitionBreakdown: Array<{
      definition: QueryDefinition<any, any>;
      count: number;
      name?: string;
    }>;
  } {
    const definitionBreakdown = Array.from(this.cache.entries()).map(
      ([definition, paramMap]) => ({
        definition,
        count: paramMap.size,
      })
    );

    return {
      totalQueries: this.totalSize,
      uniqueDefinitions: this.cache.size,
      averageParamsPerDefinition:
        this.cache.size > 0 ? this.totalSize / this.cache.size : 0,
      definitionBreakdown,
    };
  }

  /**
   * Check if the cache is empty
   */
  isEmpty(): boolean {
    return this.totalSize === 0;
  }

  /**
   * Get the count of queries for a specific definition
   *
   * @param definition - The query definition reference
   * @returns Number of parameter combinations for this definition
   */
  getDefinitionSize<QD extends QueryDefinition>(definition: QD): number {
    const paramMap = this.cache.get(definition);
    return paramMap?.size ?? 0;
  }
}
