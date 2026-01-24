import type { RetryConfig } from "../Retrier";
import type { QueryDefinition } from "./query";
import type { Context } from "./types";
import type { IInvalidatable, IOptimisticUpdateable } from "./types";

export const MUTATION_SYMBOL = Symbol();

/**
 * Defines which queries should be invalidated after a mutation.
 * Can be a static array or a function that computes queries based on mutation result.
 */
type InvalidationTarget<TParams, TResult> = Array<
  | IInvalidatable
  | QueryDefinition<any, any>
  | ((
      params: TParams,
      result: TResult,
    ) =>
      | IInvalidatable
      | IInvalidatable[]
      | QueryDefinition<any, any>
      | QueryDefinition<any, any>[])
>;

/**
 * Defines an optimistic update to apply to a query before the mutation completes
 */
export type OptimisticUpdateTarget<TParams, TOptimisticUpdateableData> = {
  target: IOptimisticUpdateable;
  updater: (old: TOptimisticUpdateableData, params: TParams) => TOptimisticUpdateableData;
};

/**
 * Internal configuration for a mutation definition
 */
interface MutationConfig<TParams = unknown, TResult = unknown> {
  mutationFn: (params: TParams, ctx: Context) => Promise<TResult>;
  retry?: RetryConfig;
  retryDelay?: number | ((failureCount: number, error: unknown) => number);
  invalidates?: InvalidationTarget<TParams, TResult>;
  optimistic?: (params: TParams, ctx: Context) => OptimisticUpdateTarget<TParams, unknown>[];
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
  config: MutationConfig<TParams, TResult>,
): Readonly<MutationDefinition<TParams, TResult>> {
  return { __type: MUTATION_SYMBOL, config: config };
}

/**
 * Type guard to check if a node is a mutation definition
 */
export function isMutation(node: unknown): node is MutationDefinition {
  return (
    typeof node === "object" && node !== null && "__type" in node && node.__type === MUTATION_SYMBOL
  );
}

export { type Context, type IInvalidatable, type IOptimisticUpdateable };
