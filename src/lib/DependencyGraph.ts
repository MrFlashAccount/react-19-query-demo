import type { RetryConfig } from "./Retrier";

// core/symbols.ts
export const QUERY_SYMBOL = Symbol("query");
export const MUTATION_SYMBOL = Symbol("mutation");

export function serializeParams(params: unknown): string {
  if (params === undefined || params === null) {
    return "";
  }

  if (typeof params === "object" && !Array.isArray(params)) {
    const sorted = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = (params as any)[key];
        return acc;
      }, {} as any);
    return JSON.stringify(sorted);
  }

  return JSON.stringify(params);
}

interface QueryConfig<TData = unknown, TParams = void> {
  queryFn: (params: TParams) => Promise<TData>;
}

export interface Query<TData = unknown, TParams = void> {
  readonly __type: typeof QUERY_SYMBOL;
  __index?: number;
  readonly config: QueryConfig<TData, TParams>;
}

/**
 * Options for a query
 */
export interface QueryOptions<TParams = unknown, TData = unknown> {
  /** Function that returns a promise to fetch data */
  queryFn: (params: TParams) => Promise<TData>;
  /** Time in milliseconds after which the query will be garbage collected. Default: Infinity */
  gcTime?: number;
  /** Time in milliseconds until data becomes stale. Can be 'static' to never refetch. Default: 0 */
  staleTime?: number | "static";
  /** Retry configuration - number of retries, boolean, or custom function. Default: true (3 retries) */
  retry?: RetryConfig;
  /** Delay between retries in milliseconds. Default: 0 */
  retryDelay?: number | ((failureCount: number, error: unknown) => number);
}

export function query<TData = unknown, TParams = unknown>(
  config: QueryOptions<TParams, TData>
): Query<TData, TParams> {
  return {
    __type: QUERY_SYMBOL,
    config,
  };
}

export function isQuery(node: unknown): node is Query {
  return (
    typeof node === "object" &&
    node !== null &&
    "__type" in node &&
    node.__type === QUERY_SYMBOL
  );
}

export function getQueryInstanceKey(query: Query, params?: unknown): string {
  if (query.__index === undefined) {
    throw new Error("Query must be registered in DependencyGraph before use");
  }

  const paramsKey = serializeParams(params);
  return paramsKey ? `${query.__index}:${paramsKey}` : `${query.__index}`;
}

type InvalidationTarget<TParams, TResult> =
  | Query[]
  | ((params: TParams, result: TResult) => Query[]);

type OptimisticUpdateTarget<TParams, TData> = {
  query: Query;
  updater: (old: any, params: TParams, data: TData) => any;
};

interface MutationConfig<TData = unknown, TParams = void, TResult = unknown> {
  mutationFn: (params: TParams, data: TData) => Promise<TResult>;
  invalidates?: InvalidationTarget<TParams, TResult>;
  optimistic?: (
    params: TParams,
    data: TData
  ) => OptimisticUpdateTarget<TParams, TData>[];
}

export interface Mutation<TData = unknown, TParams = void, TResult = unknown> {
  readonly __type: typeof MUTATION_SYMBOL;
  __index?: number;
  readonly config: MutationConfig<TData, TParams, TResult>;
}

export function mutation<TData = unknown, TParams = void, TResult = unknown>(
  config: MutationConfig<TData, TParams, TResult>
): Mutation<TData, TParams, TResult> {
  return {
    __type: MUTATION_SYMBOL,
    config,
  };
}

export function isMutation(node: unknown): node is Mutation {
  return (
    typeof node === "object" &&
    node !== null &&
    "__type" in node &&
    node.__type === MUTATION_SYMBOL
  );
}

type GraphNode = Query | Mutation;

interface ParsedInvalidation {
  mutationIndex: number;
  queryIndex: number;
  conditional: boolean;
}

interface ParsedOptimisticUpdate {
  mutationIndex: number;
  queryIndex: number;
  conditional: boolean;
}

export class DependencyGraph {
  private nodesByIndex = new Map<number, GraphNode>();
  private queries = new Map<number, Query>();
  private mutations = new Map<number, Mutation>();

  private invalidations: ParsedInvalidation[] = [];
  private optimisticUpdates: ParsedOptimisticUpdate[] = [];

  constructor(nodes: GraphNode[]) {
    this.buildGraph(nodes);
  }

  private buildGraph(nodes: GraphNode[]): void {
    // Первый проход: присваиваем индексы
    nodes.forEach((node, index) => {
      (node as any).__index = index;
      this.nodesByIndex.set(index, node);

      if (isQuery(node)) {
        this.queries.set(index, node);
      } else if (isMutation(node)) {
        this.mutations.set(index, node);
      } else {
        throw new Error("Invalid node type in dependency graph");
      }
    });

    // Второй проход: парсим связи
    for (const [index, node] of this.nodesByIndex) {
      if (isMutation(node)) {
        this.parseMutationRelations(node);
      }
    }
  }

  private parseMutationRelations(mutation: Mutation): void {
    const { invalidates, optimistic } = mutation.config;

    if (mutation.__index === undefined) {
      throw new Error("Mutation index not set");
    }

    // Парсим инвалидации
    if (invalidates) {
      if (Array.isArray(invalidates)) {
        // Статический массив query
        for (const query of invalidates) {
          if (!isQuery(query)) {
            throw new Error("Invalid query in invalidates array");
          }
          if (query.__index === undefined) {
            throw new Error("Query index not set");
          }

          this.invalidations.push({
            mutationIndex: mutation.__index,
            queryIndex: query.__index,
            conditional: false,
          });
        }
      } else {
        // Функция - помечаем как conditional
        this.invalidations.push({
          mutationIndex: mutation.__index,
          queryIndex: -1, // marker для conditional
          conditional: true,
        });
      }
    }

    // Парсим оптимистичные обновления
    if (optimistic) {
      this.optimisticUpdates.push({
        mutationIndex: mutation.__index,
        queryIndex: -1, // marker для conditional
        conditional: true,
      });
    }
  }

  // Получить все query indices, которые инвалидируются мутацией (статические)
  getStaticInvalidations(mutationIndex: number): number[] {
    return this.invalidations
      .filter((inv) => inv.mutationIndex === mutationIndex && !inv.conditional)
      .map((inv) => inv.queryIndex);
  }

  // Проверить есть ли у мутации динамические инвалидации
  hasDynamicInvalidations(mutationIndex: number): boolean {
    return this.invalidations.some(
      (inv) => inv.mutationIndex === mutationIndex && inv.conditional
    );
  }

  // Вычислить динамические инвалидации в runtime
  computeDynamicInvalidations<TParams, TResult>(
    mutationIndex: number,
    params: TParams,
    result: TResult
  ): number[] {
    const mutation = this.mutations.get(mutationIndex);
    if (!mutation) return [];

    const { invalidates } = mutation.config;
    if (!invalidates || Array.isArray(invalidates)) return [];

    const queries = invalidates(params, result);
    return queries.map((q) => {
      if (!isQuery(q)) {
        throw new Error("Function returned invalid query");
      }
      if (q.__index === undefined) {
        throw new Error("Query index not set");
      }
      return q.__index;
    });
  }

  // Вычислить динамические оптимистичные обновления в runtime
  computeDynamicOptimisticUpdates<TParams, TData>(
    mutationIndex: number,
    params: TParams,
    data: TData
  ): Array<{ queryIndex: number; updater: (old: any) => any }> {
    const mutation = this.mutations.get(mutationIndex);
    if (!mutation) return [];

    const { optimistic } = mutation.config;
    if (!optimistic) return [];

    const updates = optimistic(params, data);
    return updates.map((update) => {
      if (!isQuery(update.query)) {
        throw new Error("Optimistic update contains invalid query");
      }
      if (update.query.__index === undefined) {
        throw new Error("Query index not set");
      }
      return {
        queryIndex: update.query.__index,
        updater: (old: any) => update.updater(old, params, data),
      };
    });
  }

  // Экспорт для devtools
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

    // Queries
    for (const [index] of this.queries) {
      nodes.push({ index, type: "query" });
    }

    // Mutations
    for (const [index] of this.mutations) {
      nodes.push({ index, type: "mutation" });
    }

    // Invalidation edges
    for (const inv of this.invalidations) {
      edges.push({
        from: inv.mutationIndex,
        to: inv.conditional ? "__dynamic__" : inv.queryIndex,
        type: "invalidates",
        conditional: inv.conditional,
      });
    }

    // Optimistic edges
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

  // Найти orphan queries
  findOrphanQueries(): number[] {
    const affectedQueries = new Set<number>();

    for (const inv of this.invalidations) {
      if (!inv.conditional) {
        affectedQueries.add(inv.queryIndex);
      }
    }

    for (const opt of this.optimisticUpdates) {
      if (!opt.conditional) {
        affectedQueries.add(opt.queryIndex);
      }
    }

    const orphans: number[] = [];
    for (const [index] of this.queries) {
      if (!affectedQueries.has(index)) {
        orphans.push(index);
      }
    }

    return orphans;
  }

  // Найти мутации без связей
  findUnconnectedMutations(): number[] {
    const unconnected: number[] = [];

    for (const [index] of this.mutations) {
      const hasInvalidations = this.invalidations.some(
        (inv) => inv.mutationIndex === index
      );
      const hasOptimistic = this.optimisticUpdates.some(
        (opt) => opt.mutationIndex === index
      );

      if (!hasInvalidations && !hasOptimistic) {
        unconnected.push(index);
      }
    }

    return unconnected;
  }

  getAllQueries(): Query[] {
    return Array.from(this.queries.values());
  }

  getAllMutations(): Mutation[] {
    return Array.from(this.mutations.values());
  }

  getQueryByIndex(index: number): Query | undefined {
    return this.queries.get(index);
  }

  getMutationByIndex(index: number): Mutation | undefined {
    return this.mutations.get(index);
  }

  size(): { queries: number; mutations: number } {
    return {
      queries: this.queries.size,
      mutations: this.mutations.size,
    };
  }
}
