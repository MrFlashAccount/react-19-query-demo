import {
  createContext,
  type PropsWithChildren,
  useState,
  use,
  useTransition,
  useEffect,
  startTransition,
  useDebugValue,
} from "react";
import { QueryClient, type QueryClientContext } from "./QueryClient";
import { noop } from "./utils";
import type {
  FulfilledQueryPromise,
  QueryPromise,
  QueryState,
  RejectedQueryPromise,
} from "./Query";
import {
  type EventEmitter,
  type EventsMap,
  eventEmitter,
} from "./EventEmitter";
import { useEvent } from "../useEvent";
import {
  type QueryDefinition,
  type MutationDefinition,
  type DependencyGraph,
} from "./DependencyGraph";

/**
 * Context value for the query provider
 */
export type QueryContextValue = {
  queryClient: QueryClient;
  graph: DependencyGraph;
};
/**
 * Query Context - exposed for testing purposes.
 * In production code, use the useQuery hook instead of accessing this directly.
 */
export const QueryContext = createContext<QueryContextValue | null>(null);

/**
 * Props for {@link QueryProvider}
 */
export type QueryProviderProps = {
  context?: QueryClientContext;
  /** Optional event emitter for debugging */
  eventEmitter?: EventEmitter<EventsMap>;
} & (
  | {
      queryClient: QueryClient;
      graph?: never;
    }
  | {
      queryClient?: never;
      graph: DependencyGraph;
    }
) &
  PropsWithChildren;

/**
 * Query Provider component that manages query instances based on a dependency graph.
 *
 * Features:
 * - Manages query instances by definition + params
 * - Tracks active subscriptions per cache entry
 * - Only triggers GC when there are no active subscriptions
 * - Cancels GC timer when new subscriptions are added
 * - Uses dependency graph for invalidations and optimistic updates
 *
 * @example
 * ```tsx
 * const graph = new DependencyGraph([moviesQuery, addMovieMutation]);
 *
 * <QueryProvider graph={graph}>
 *   <App />
 * </QueryProvider>
 * ```
 */
export function QueryProvider({
  context = {} as Readonly<QueryClientContext>,
  children,
  graph,
  queryClient: initialQueryClient,
}: QueryProviderProps) {
  const [queryClient, setQueryClient] = useState(() => {
    const onChange = (newInstance: QueryClient) => {
      eventEmitter.emit("client:change", { client: newInstance });
      startTransition(() => {
        setQueryClient(newInstance);
      });
    };

    if (initialQueryClient !== undefined) {
      initialQueryClient.setOptions({ onChange });
      return initialQueryClient;
    }

    return new QueryClient({ graph, onChange, context });
  });

  queryClient.setOptions({ context });

  return (
    <QueryContext value={{ queryClient, graph: queryClient.getGraph() }}>
      {children}
    </QueryContext>
  );
}

/**
 * Options for useQuery hook with parameters
 */
export interface UseQueryOptions<
  QD extends QueryDefinition<TParams, TData>,
  TParams extends unknown = unknown,
  TData extends unknown = unknown
> {
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

export function useQueryClient(): QueryClient {
  const context = use(QueryContext);
  if (!context) {
    throw new Error("useQueryClient must be used within a QueryProvider");
  }
  return context.queryClient;
}

export function useQueryContext(): QueryContextValue {
  const context = use(QueryContext);
  if (!context) {
    throw new Error("useQueryContext must be used within a QueryProvider");
  }
  return context;
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
  refetch: () => QueryPromise<TData>;
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
  QD extends QueryDefinition<TParams, TData>,
  TParams extends unknown = unknown,
  TData extends unknown = unknown
>(options: UseQueryOptions<QD, TParams, TData>): UseQueryResult<TData> {
  const { query: queryDefinition } = options;
  const params = "params" in options ? options.params : ({} as TParams);
  const { queryClient } = useQueryContext();
  const [isPendingTransition, startPendingTransition] = useTransition();

  // Add or get query instance from cache
  const query = queryClient.addQuery<QD, TParams, TData>(
    queryDefinition,
    params,
    { prefetch: true }
  );

  const queryState = query.getState();
  const isPending = queryState.status === "pending" || isPendingTransition;
  const isFetching = queryState.fetchStatus === "fetching";
  const isSuccess = queryState.status === "fulfilled";
  const isError = queryState.status === "rejected";

  const refetch = useEvent(() => {
    startPendingTransition(async () => {
      await query.fetch();
    });
    return query.promise;
  });

  // Subscribe to query changes
  useEffect(() => query.subscribe(noop), [query]);

  useDebugValue(query);
  useDebugValue(queryState);
  useDebugValue(query.promise);

  return {
    isPending,
    isFetching,
    isSuccess,
    isError,
    state: queryState,
    promise: query.promise,
    refetch,
  } as const;
}

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
  options: UseMutationOptions<TParams, TResult>
): UseMutationResult<TParams, TResult> {
  const { mutation: mutationDefinition } = options;
  const { queryClient, graph } = useQueryContext();

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<Error | null>(null);

  const mutate = useEvent(async (params: TParams): Promise<TResult> => {
    const scope = eventEmitter.createScope();
    scope.emit("mutation:start", { variables: { params } });
    const executionScope = scope.createChildScope();
    executionScope.emit("mutation:execution:start", {
      variables: { params },
    });

    return new Promise<TResult>((resolve, reject) => {
      startTransition(async () => {
        setError(null);

        try {
          // Execute the mutation
          const result = await mutationDefinition.config.mutationFn(
            params,
            queryClient.getContext()
          );

          executionScope.emit("mutation:execution:success", {
            variables: { params },
            data: result,
          });

          const mutationIndex = mutationDefinition.__index!;

          // Handle static invalidations
          const staticInvalidations =
            graph.getStaticInvalidations(mutationIndex);
          if (staticInvalidations.length > 0) {
            const invalidationScope = scope.createChildScope();
            const queries = staticInvalidations.map((idx) => `query:${idx}`);
            invalidationScope.emit("mutation:invalidation:start", {
              variables: { params },
              queries,
            });

            await Promise.all(
              staticInvalidations.map((queryIndex) => {
                const queryDef = graph.getQueryByIndex(queryIndex);
                if (queryDef) {
                  return queryClient.invalidateQuery(queryDef, {
                    parentScopeId: invalidationScope.scopeId,
                  });
                }
              })
            );

            invalidationScope.emit("mutation:invalidation:success", {
              variables: { params },
              queries,
            });
          }

          // Handle dynamic invalidations
          if (graph.hasDynamicInvalidations(mutationIndex)) {
            const dynamicInvalidations = graph.computeDynamicInvalidations(
              mutationIndex,
              params,
              result
            );

            if (dynamicInvalidations.length > 0) {
              const invalidationScope = scope.createChildScope();
              const queries = dynamicInvalidations.map((idx) => `query:${idx}`);
              invalidationScope.emit("mutation:invalidation:start", {
                variables: { params },
                queries,
              });

              await Promise.all(
                dynamicInvalidations.map((queryIndex) => {
                  const queryDef = graph.getQueryByIndex(queryIndex);
                  if (queryDef) {
                    return queryClient.invalidateQuery(queryDef, {
                      parentScopeId: invalidationScope.scopeId,
                    });
                  }
                })
              );

              invalidationScope.emit("mutation:invalidation:success", {
                variables: { params },
                queries,
              });
            }
          }

          // TODO: Handle optimistic updates
          // const updates = graph.computeDynamicOptimisticUpdates(mutationIndex, params, data);
          // For now, we just invalidate

          scope.emit("mutation:success", {
            variables: { params },
            data: result,
          });

          resolve(result);
        } catch (err) {
          const errorObj = err instanceof Error ? err : new Error(String(err));
          setError(errorObj);

          executionScope.emit("mutation:execution:error", {
            variables: { params },
            error: errorObj,
          });

          scope.emit("mutation:error", {
            variables: { params },
            error: errorObj,
          });

          reject(errorObj);
        }
      });
    });
  });

  return { mutate, isPending, error };
}
