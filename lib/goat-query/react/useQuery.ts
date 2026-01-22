import type { QueryState } from "../Query";
import type { FulfilledQueryPromise, QueryPromise, RejectedQueryPromise } from "../QueryPromise";
import { useDebugValue, useEffect } from "react";

import { type QueryData, type QueryDefinition, type QueryParams } from "../nodes/query";
import { noop } from "../utils";

import { useQueryContext } from "./QueryProvider";

/**
 * Options for useQuery hook with parameters
 */
export interface UseQueryOptions<QD extends QueryDefinition<any, any>, TParams = QueryParams<QD>> {
  /** The query definition */
  query: QD;
  /** The parameters for this query instance */
  params: TParams;
}

/**
 * Options for useQuery hook without parameters (void params)
 */
export interface UseQueryOptionsNoParams<TData> {
  /** The query definition */
  query: QueryDefinition<void, TData>;
}

/**
 * Hook to fetch and cache data based on a query definition.
 *
 * Automatically manages subscriptions:
 * - Subscribes on mount
 * - Unsubscribes on unmount
 * - Re-subscribes when definition or params change
 *
 * GC behavior:
 * - GC timer only runs when subscriptions = 0
 * - Timer is cancelled when component mounts
 * - Timer starts when component unmounts
 *
 * Stale behavior:
 * - Stale queries are refetched automatically in the background when new instances mount
 *
 * @example
 * ```tsx
 * // With parameters
 * function UserProfile({ userId }) {
 *   const { promise } = useQuery({
 *     query: userQuery,
 *     params: { userId }
 *   });
 *   const user = use(promise);
 *   return <div>{user.name}</div>;
 * }
 *
 * // Without parameters
 * function CurrentUser() {
 *   const { promise } = useQuery({ query: currentUserQuery });
 *   const user = use(promise);
 *   return <div>{user.name}</div>;
 * }
 * ```
 */
export interface UseQueryResult<TData> {
  promise: QueryPromise<TData>;
  isPending: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  isError: boolean;
  state: Readonly<QueryState<TData>>;
  refetch: () => void;
}

export interface UseQueryFullfilledResult<TData> extends UseQueryResult<TData> {
  state: Readonly<QueryState<TData>>;
  promise: FulfilledQueryPromise<TData>;
}

export interface UseQueryRejectedResult<TData> extends UseQueryResult<TData> {
  state: Readonly<QueryState<TData>>;
  promise: RejectedQueryPromise;
}

export function useQuery<
  QD extends QueryDefinition<any, any>,
  TParams = QueryParams<QD>,
  TData = QueryData<QD>,
>(options: UseQueryOptions<QD, TParams>): UseQueryResult<TData> {
  const { query: queryDefinition } = options;
  const params = options.params;
  const { queryClient } = useQueryContext();

  // Add or get query instance from cache
  const query = queryClient.addQuery<QD, TParams, TData>(queryDefinition, params, {
    prefetch: true,
  });

  const queryState = query.getState();
  const isPending = queryState.status === "pending";
  const isFetching = queryState.fetchStatus === "fetching";
  const isSuccess = queryState.status === "fulfilled";
  const isError = queryState.status === "rejected";

  // Subscribe to query changes
  useEffect(() => query.subscribe(noop), [query]);

  if (import.meta.env.DEV) {
    useDebugValue(query, (query) => {
      return {
        "🕛 pending": query.getState().status === "pending",
        "🔄 fetching": query.getState().fetchStatus === "fetching",
        "✅ success": query.getState().status === "fulfilled",
        "❌ error": query.getState().status === "rejected",
        "🕒 stale": query.isStale(),
        "🔍 data": query.getState().data,
        "📦 params": query.getKey().params,
        "📦 definition": query.getKey().definition,
      };
    });
  }

  return {
    isPending,
    isFetching,
    isSuccess,
    isError,
    state: queryState,
    promise: query.promise,
    refetch: () => query.refetch(),
  };
}
