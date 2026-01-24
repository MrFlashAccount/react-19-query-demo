import type { RetryConfig } from "../Retrier";
import type { Context } from "./types";

import { serializeParams } from "../utils";

export const QUERY_SYMBOL = Symbol();

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
export interface QueryDefinition<TParams = unknown, TData = unknown> {
  readonly __type: typeof QUERY_SYMBOL;
  readonly __index?: number;
  readonly config: QueryConfig<TParams, TData>;
}

export type AnyQueryDefinition = QueryDefinition<any, any>;

export type QueryFn<QD extends AnyQueryDefinition> = QD["config"]["queryFn"];
export type QueryFnResult<QD extends AnyQueryDefinition> = ReturnType<QueryFn<QD>>;
export type QueryParams<QD extends AnyQueryDefinition> = Parameters<QueryFn<QD>>[0];
export type QueryData<QD extends AnyQueryDefinition> =
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

export function query<TParams extends unknown = never, TData extends unknown = unknown>(
  config: Readonly<QueryConfig<TParams, TData>>,
): Readonly<QueryDefinition<TParams, TData>> {
  return { __type: QUERY_SYMBOL, config: config };
}

/**
 * Type guard to check if a node is a query definition
 */
export function isQuery(node: unknown): node is QueryDefinition {
  return (
    typeof node === "object" && node !== null && "__type" in node && node.__type === QUERY_SYMBOL
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

export { type Context };
