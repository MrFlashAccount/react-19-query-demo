import type { RetryConfig } from "./Retrier";

// Symbols for identifying query and mutation definitions
export const QUERY_SYMBOL = Symbol();
export const MUTATION_SYMBOL = Symbol();

// Marker for dynamic (conditional) relationships in the graph
const DYNAMIC_MARKER = -1;

/**
 * Serialize query parameters into a stable string representation for cache keys.
 * Objects are sorted by keys to ensure consistent serialization.
 *
 * @param params - The parameters to serialize
 * @returns Serialized string representation
 */
export function serializeParams(params: unknown): string {
  if (params === undefined || params === null) {
    return "__void__";
  }

  return JSON.stringify(params, (_, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const sorted = Object.entries(value).sort((a, b) => {
        if (a[0] < b[0]) return -1;
        if (a[0] > b[0]) return 1;
        return 0;
      });

      return sorted;
    }

    return value;
  });
}

export interface Context {
  [key: string]: unknown;
}

export interface QueryFnContext extends Context {
  readonly signal: AbortSignal;
}

/**
 * Internal configuration for a query definition
 */
interface QueryConfig<TParams = unknown, TData = unknown> {
  queryFn: (params: TParams, ctx: QueryFnContext) => Promise<TData>;
  gcTime?: number;
  staleTime?: number | "static";
  retry?: RetryConfig;
  retryDelay?: number | ((failureCount: number, error: unknown) => number);
}

/**
 * A query definition that describes how to fetch data.
 * This is a type-level construct that gets registered in the dependency graph.
 */
export interface QueryDefinition<
  TParams extends unknown = unknown,
  TData extends unknown = unknown
> {
  readonly __type: typeof QUERY_SYMBOL;
  readonly __index?: number;
  readonly config: QueryConfig<TParams, TData>;
}

export type QueryFn<QD extends QueryDefinition> = QD["config"]["queryFn"];
export type QueryFnResult<QD extends QueryDefinition> = ReturnType<QueryFn<QD>>;
export type QueryParams<QD extends QueryDefinition> = Parameters<
  QueryFn<QD>
>[0];
export type QueryData<QD extends QueryDefinition> =
  QueryFnResult<QD> extends Promise<infer T> ? T : never;

/**
 * Creates a query definition that can be registered in a dependency graph.
 *
 * @param config - Query configuration including queryFn and cache options
 * @returns A query definition that can be used with useQuery
 *
 * @example
 * ```typescript
 * const moviesQuery = query<{ page: number }>({
 *   queryFn: async ({ params }) => {
 *     const res = await fetch(`/api/movies?page=${params.page}`);
 *     return res.json();
 *   },
 *   staleTime: 5000,
 *   gcTime: 60000,
 * });
 * ```
 */

export function query<
  TParams extends unknown = never,
  TData extends unknown = unknown
>(
  config: Readonly<QueryConfig<TParams, TData>>
): Readonly<QueryDefinition<TParams, TData>> {
  return { __type: QUERY_SYMBOL, config: config };
}

/**
 * Type guard to check if a node is a query definition
 */
export function isQuery(node: unknown): node is QueryDefinition {
  return (
    typeof node === "object" &&
    node !== null &&
    "__type" in node &&
    node.__type === QUERY_SYMBOL
  );
}

/**
 * Generates a unique cache key for a query instance (definition + params).
 * Format: "<identifier>:<serializedParams>" or "<identifier>" for void params
 *
 * Note: This function is maintained for backward compatibility.
 * New code should use QueryCache with definition references directly.
 *
 * @param query - The query definition
 * @param params - The query parameters
 * @returns A unique string key for caching
 */
export function getQueryInstanceKey(params: unknown): string {
  return serializeParams(params);
}

/**
 * Defines which queries should be invalidated after a mutation.
 * Can be a static array or a function that computes queries based on mutation result.
 */
type InvalidationTarget<TParams, TResult> =
  | QueryDefinition<any, any>[]
  | ((params: TParams, result: TResult) => QueryDefinition<any, any>[]);

/**
 * Defines an optimistic update to apply to a query before the mutation completes
 */
type OptimisticUpdateTarget<TParams, TQueryData> = {
  query: QueryDefinition<any, TQueryData>;
  updater: (old: TQueryData, params: TParams) => TQueryData;
};

/**
 * Internal configuration for a mutation definition
 */
interface MutationConfig<TParams = unknown, TResult = unknown> {
  mutationFn: (params: TParams, ctx: Context) => Promise<TResult>;
  invalidates?: InvalidationTarget<TParams, TResult>;
  optimistic?: (
    params: TParams,
    ctx: Context
  ) => OptimisticUpdateTarget<TParams, unknown>[];
}

/**
 * A mutation definition that describes how to perform a data mutation.
 * This is a type-level construct that gets registered in the dependency graph.
 */
export interface MutationDefinition<TParams = unknown, TResult = unknown> {
  readonly __type: typeof MUTATION_SYMBOL;
  __index?: number;
  readonly config: MutationConfig<TParams, TResult>;
}

/**
 * Creates a mutation definition that can be registered in a dependency graph.
 *
 * @param config - Mutation configuration including mutationFn, invalidations, and optimistic updates
 * @returns A mutation definition that can be used with useMutation
 *
 * @example
 * ```typescript
 * const addMovieMutation = mutation<{ movieId: string }>({
 *   mutationFn: async ({ params }) => {
 *     const res = await fetch(`/api/movies/${params.movieId}`, {
 *       method: 'POST',
 *       body: JSON.stringify(data)
 *     });
 *     return res.json();
 *   },
 *   invalidates: [moviesQuery],
 *   optimistic: ({ params }) => [{
 *     query: moviesQuery,
 *     updater: (old) => [...old, newMovie]
 *   }]
 * });
 * ```
 */
export function mutation<TParams = unknown, TResult = unknown>(
  config: MutationConfig<TParams, TResult>
): Readonly<MutationDefinition<TParams, TResult>> {
  return { __type: MUTATION_SYMBOL, config: config };
}

/**
 * Type guard to check if a node is a mutation definition
 */
export function isMutation(node: unknown): node is MutationDefinition {
  return (
    typeof node === "object" &&
    node !== null &&
    "__type" in node &&
    node.__type === MUTATION_SYMBOL
  );
}

/**
 * A node in the dependency graph (either a query or mutation definition)
 * Uses 'any' for type parameters to accept definitions with any params
 */
type GraphNode = QueryDefinition<any, any> | MutationDefinition<any, any>;

/**
 * Parsed invalidation relationship between a mutation and query
 */
interface ParsedInvalidation {
  mutationIndex: number;
  queryIndex: number;
  conditional: boolean;
}

/**
 * Parsed optimistic update relationship between a mutation and query
 */
interface ParsedOptimisticUpdate {
  mutationIndex: number;
  queryIndex: number;
  conditional: boolean;
}

/**
 * Manages the dependency graph between queries and mutations.
 * Parses relationships at construction time and provides efficient lookups at runtime.
 */
export class DependencyGraph {
  private nodesByIndex = new Map<number, GraphNode>();
  private queries = new Map<number, QueryDefinition<any, any>>();
  private mutations = new Map<number, MutationDefinition<any, any>>();

  private invalidations: ParsedInvalidation[] = [];
  private optimisticUpdates: ParsedOptimisticUpdate[] = [];

  /**
   * Creates a dependency graph from an array of query and mutation definitions.
   * Assigns indices to each node and parses relationships.
   *
   * @param nodes - Array of query and mutation definitions
   *
   * @example
   * ```typescript
   * const graph = new DependencyGraph([
   *   moviesQuery,
   *   movieDetailQuery,
   *   addMovieMutation,
   * ]);
   * ```
   */
  constructor(nodes: GraphNode[]) {
    this.buildGraph(nodes);
  }

  /**
   * Builds the graph by assigning indices and parsing relationships
   */
  private buildGraph(nodes: GraphNode[]): void {
    // First pass: assign indices to all nodes
    nodes.forEach((node, index) => {
      // Mutate the __index property to assign the graph index
      (node as { __index?: number }).__index = index;
      this.nodesByIndex.set(index, node);

      if (isQuery(node)) {
        this.queries.set(index, node);
      } else if (isMutation(node)) {
        this.mutations.set(index, node);
      } else {
        throw new Error(
          `Invalid node type in dependency graph at index ${index}. ` +
            `Expected query or mutation definition.`
        );
      }
    });

    // Second pass: parse mutation relationships
    for (const node of this.nodesByIndex.values()) {
      if (isMutation(node)) {
        this.parseMutationRelations(node);
      }
    }
  }

  /**
   * Parses invalidation and optimistic update relationships for a mutation
   */
  private parseMutationRelations(mutation: MutationDefinition): void {
    const { invalidates, optimistic } = mutation.config;

    if (mutation.__index === undefined) {
      throw new Error(
        "Mutation index not set. This is an internal error in graph construction."
      );
    }

    // Parse invalidation relationships
    if (invalidates) {
      if (Array.isArray(invalidates)) {
        // Static array of queries to invalidate
        for (const query of invalidates) {
          if (!isQuery(query)) {
            throw new Error(
              `Invalid query in invalidates array for mutation at index ${mutation.__index}. ` +
                `Expected a query definition.`
            );
          }
          if (query.__index === undefined) {
            throw new Error(
              `Query in invalidates array for mutation at index ${mutation.__index} ` +
                `has no index. Make sure the query is registered in the graph.`
            );
          }

          this.invalidations.push({
            mutationIndex: mutation.__index,
            queryIndex: query.__index,
            conditional: false,
          });
        }
      } else {
        // Function - mark as conditional (will be computed at runtime)
        this.invalidations.push({
          mutationIndex: mutation.__index,
          queryIndex: DYNAMIC_MARKER,
          conditional: true,
        });
      }
    }

    // Parse optimistic update relationships
    if (optimistic) {
      this.optimisticUpdates.push({
        mutationIndex: mutation.__index,
        queryIndex: DYNAMIC_MARKER,
        conditional: true,
      });
    }
  }

  /**
   * Get all query indices that are statically invalidated by a mutation.
   * Static invalidations are known at graph construction time.
   *
   * @param mutationIndex - The mutation's graph index
   * @returns Array of query indices to invalidate
   */
  getStaticInvalidations(mutationIndex: number): number[] {
    return this.invalidations
      .filter((inv) => inv.mutationIndex === mutationIndex && !inv.conditional)
      .map((inv) => inv.queryIndex);
  }

  /**
   * Check if a mutation has dynamic (conditional) invalidations.
   * Dynamic invalidations are computed at runtime based on mutation result.
   *
   * @param mutationIndex - The mutation's graph index
   * @returns True if the mutation has dynamic invalidations
   */
  hasDynamicInvalidations(mutationIndex: number): boolean {
    return this.invalidations.some(
      (inv) => inv.mutationIndex === mutationIndex && inv.conditional
    );
  }

  /**
   * Compute dynamic invalidations at runtime based on mutation params and result.
   * Should only be called if hasDynamicInvalidations returns true.
   *
   * @param mutationIndex - The mutation's graph index
   * @param params - The mutation parameters
   * @param result - The mutation result
   * @returns Array of query indices to invalidate
   */
  computeDynamicInvalidations<TParams, TResult>(
    mutationIndex: number,
    params: TParams,
    result: TResult
  ): number[] {
    const mutation = this.mutations.get(mutationIndex);
    if (!mutation) return [];

    const { invalidates } = mutation.config;
    if (!invalidates || Array.isArray(invalidates)) return [];

    // Type assertion needed since mutation is retrieved from untyped map
    const queries = (
      invalidates as (
        params: TParams,
        result: TResult
      ) => QueryDefinition<any, any>[]
    )(params, result);
    return queries.map((q) => {
      if (!isQuery(q)) {
        throw new Error(
          `Dynamic invalidation function for mutation ${mutationIndex} ` +
            `returned an invalid query. Expected a query definition.`
        );
      }
      if (q.__index === undefined) {
        throw new Error(
          `Dynamic invalidation function for mutation ${mutationIndex} ` +
            `returned a query with no index. Make sure the query is registered in the graph.`
        );
      }
      return q.__index;
    });
  }

  /**
   * Compute dynamic optimistic updates at runtime based on mutation params and data.
   *
   * @param mutationIndex - The mutation's graph index
   * @param params - The mutation parameters
   * @param data - The mutation data
   * @returns Array of { queryIndex, updater } pairs to apply
   */
  computeDynamicOptimisticUpdates<TParams, TData>(
    mutationIndex: number,
    params: TParams,
    data: TData
  ): Array<{ queryIndex: number; updater: (old: unknown) => unknown }> {
    const mutation = this.mutations.get(mutationIndex);
    if (!mutation) return [];

    const { optimistic } = mutation.config;
    if (!optimistic) return [];

    // Type assertion needed since mutation is retrieved from untyped map
    type OptimisticFn = (
      params: TParams,
      data: TData
    ) => Array<{
      query: QueryDefinition<any, any>;
      updater: (old: unknown, params: TParams, data: TData) => unknown;
    }>;
    const updates = (optimistic as OptimisticFn)(params, data);

    return updates.map((update) => {
      if (!isQuery(update.query)) {
        throw new Error(
          `Optimistic update function for mutation ${mutationIndex} ` +
            `contains an invalid query. Expected a query definition.`
        );
      }
      if (update.query.__index === undefined) {
        throw new Error(
          `Optimistic update function for mutation ${mutationIndex} ` +
            `contains a query with no index. Make sure the query is registered in the graph.`
        );
      }
      return {
        queryIndex: update.query.__index,
        updater: (old: unknown) => update.updater(old, params, data),
      };
    });
  }

  /**
   * Export the graph structure for visualization and debugging (e.g., devtools).
   *
   * @returns Object containing nodes and edges of the graph
   */
  exportGraph(): {
    nodes: Array<{ index: number; type: "query" | "mutation" }>;
    edges: Array<{
      from: number;
      to: number | string;
      type: "invalidates" | "optimistic";
      conditional: boolean;
    }>;
  } {
    const nodes: Array<{ index: number; type: "query" | "mutation" }> = [];
    const edges: Array<{
      from: number;
      to: number | string;
      type: "invalidates" | "optimistic";
      conditional: boolean;
    }> = [];

    // Add all query nodes
    for (const [index] of this.queries) {
      nodes.push({ index, type: "query" });
    }

    // Add all mutation nodes
    for (const [index] of this.mutations) {
      nodes.push({ index, type: "mutation" });
    }

    // Add invalidation edges
    for (const inv of this.invalidations) {
      edges.push({
        from: inv.mutationIndex,
        to: inv.conditional ? "__dynamic__" : inv.queryIndex,
        type: "invalidates",
        conditional: inv.conditional,
      });
    }

    // Add optimistic update edges
    for (const opt of this.optimisticUpdates) {
      edges.push({
        from: opt.mutationIndex,
        to: opt.conditional ? "__dynamic__" : opt.queryIndex,
        type: "optimistic",
        conditional: opt.conditional,
      });
    }

    return { nodes, edges };
  }

  /**
   * Get a query definition by its graph index
   */
  getQueryByIndex(index: number): QueryDefinition<any, any> | undefined {
    return this.queries.get(index);
  }

  /**
   * Get a mutation definition by its graph index
   */
  getMutationByIndex(index: number): MutationDefinition<any, any> | undefined {
    return this.mutations.get(index);
  }
}
