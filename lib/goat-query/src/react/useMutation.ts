import type { MutationDefinition } from "../nodes/mutation";
import type { QueryPromise } from "../QueryPromise";
import { useOptimistic, useTransition } from "react";

import { useQueryContext } from "./QueryProvider";
import { useEvent } from "./useEvent";

/**
 * Options for useMutation hook
 */
export interface UseMutationOptions<TParams, TResult> {
  /** The mutation definition from the dependency graph */
  mutation: MutationDefinition<TParams, TResult>;
}

/**
 * Result returned by useMutation hook
 */
export interface UseMutationResult<TParams, TResult> {
  /** Function to trigger the mutation */
  mutate: (params: TParams) => Promise<TResult>;
  /** Whether the mutation is currently running */
  isPending: boolean;
  /** Error from the last mutation attempt, or null if no error */
  error: Error | null;
  /** Promise returned by the mutation */
  promise: Promise<TResult> | null;
  status: QueryPromise<TResult>["status"];
  fetchStatus: QueryPromise<TResult>["fetchStatus"];
  isSuccess: boolean;
  isError: boolean;
}

/**
 * Hook to perform mutations with automatic graph-based query invalidation.
 *
 * Features:
 * - Wraps mutation in async transition
 * - Uses dependency graph for automatic invalidations
 * - Supports optimistic updates
 * - Tracks loading and error states
 * - Stable mutate function that doesn't cause re-renders
 *
 * @example
 * ```tsx
 * function AddMovie() {
 *   const { mutate, isPending, error } = useMutation({
 *     mutation: addMovieMutation
 *   });
 *
 *   const handleSubmit = async (movie: Movie) => {
 *     const result = await mutate(undefined, movie);
 *     console.log('Created:', result);
 *   };
 *
 *   return (
 *     <form onSubmit={(e) => {
 *       e.preventDefault();
 *       handleSubmit(movie);
 *     }}>
 *       {isPending && <Spinner />}
 *       {error && <Error message={error.message} />}
 *     </form>
 *   );
 * }
 * ```
 */
export function useMutation<TParams, TResult>(
  options: UseMutationOptions<TParams, TResult>,
): UseMutationResult<TParams, TResult> {
  const { mutation: mutationDefinition } = options;
  const { queryClient } = useQueryContext();

  const [pendingPromise, setPendingPromise] = useOptimistic<QueryPromise<TResult> | null>(null);
  const [isPendingTransition, startPendingTransition] = useTransition();

  const mutation = queryClient.addMutation<TParams, TResult>(mutationDefinition);

  const mutate = useEvent(function mutate(params: TParams): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      startPendingTransition(() => {
        const promise = mutation.mutate(params);
        setPendingPromise(promise);
        return promise.then(resolve).catch(reject);
      });
    });
  });

  const state = pendingPromise ? mutation.getState(pendingPromise) : null;
  let status: QueryPromise<TResult>["status"] = "pending";
  let isPending = false;
  let isSuccess = false;
  let isError = false;
  let error: QueryPromise<TResult>["reason"] = null;
  let fetchStatus: QueryPromise<TResult>["fetchStatus"] = "idle";

  if (state !== null) {
    isPending = state.status === "pending" || isPendingTransition;
    isSuccess = state.status === "fulfilled";
    isError = state.status === "rejected";
    error = state.error;
    fetchStatus = state.fetchStatus;
  }

  return {
    mutate,
    isPending,
    isSuccess,
    isError,
    error: error as Error | null,
    promise: pendingPromise,
    status,
    fetchStatus,
  };
}
