import {
  createContext,
  type PropsWithChildren,
  useState,
  use,
  useTransition,
  useEffect,
  startTransition,
  useDebugValue,
  useOptimistic,
} from "react";
import { QueryClient, type QueryClientContext } from "../QueryClient";
import { noop } from "../utils";
import {
  type FulfilledQueryPromise,
  type QueryPromise,
  type RejectedQueryPromise,
} from "../QueryPromise";
import {
  type EventEmitter,
  type EventsMap,
  eventEmitter,
} from "../EventEmitter";
import { useEvent } from "./useEvent";
import {
  type QueryDefinition,
  type MutationDefinition,
  type DependencyGraph,
  type QueryData,
  type QueryParams,
  serializeParams,
  type SerializedParams,
} from "../DependencyGraph";
import type { QueryState } from "../Query";

/**
 * Context value for the query provider
 */
export type QueryContextValue = {
  queryClient: QueryClient;
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

  return <QueryContext value={{ queryClient }}>{children}</QueryContext>;
}

const SERIALIZED_PARAMS_SYMBOL = Symbol("serializedParams");

type WithSerializedParams<TParams> = TParams & {
  [SERIALIZED_PARAMS_SYMBOL]: SerializedParams;
};

export function params<const TParams>(
  params: TParams
): WithSerializedParams<TParams> {
  if ((params as any)[SERIALIZED_PARAMS_SYMBOL] !== undefined) {
    return params as WithSerializedParams<TParams>;
  }

  Object.defineProperty(params, SERIALIZED_PARAMS_SYMBOL, {
    value: serializeParams(params),
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return params as WithSerializedParams<TParams>;
}

/**
 * Options for useQuery hook with parameters
 */
export interface UseQueryOptions<
  QD extends QueryDefinition<any, any>,
  TParams = QueryParams<QD>
> {
  /** The query definition */
  query: QD;
  /** The parameters for this query instance */
  params: WithSerializedParams<TParams>;
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
  QD extends QueryDefinition<any, any>,
  TParams = QueryParams<QD>,
  TData = QueryData<QD>
>(options: UseQueryOptions<QD, TParams>): UseQueryResult<TData> {
  const { query: queryDefinition } = options;
  const params = options.params;
  const { queryClient } = useQueryContext();
  const [isPendingTransition, startPendingTransition] = useTransition();

  // Add or get query instance from cache
  const query = queryClient.addQueryRaw<QD, TParams, TData>(
    queryDefinition,
    params,
    params[SERIALIZED_PARAMS_SYMBOL],
    { prefetch: true }
  );

  const queryState = query.getState();
  const isPending = queryState.status === "pending" || isPendingTransition;
  const isFetching = queryState.fetchStatus === "fetching";
  const isSuccess = queryState.status === "fulfilled";
  const isError = queryState.status === "rejected";

  const refetch = useEvent(function refetch() {
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
  };
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
  options: UseMutationOptions<TParams, TResult>
): UseMutationResult<TParams, TResult> {
  const { mutation: mutationDefinition } = options;
  const { queryClient } = useQueryContext();

  const [pendingPromise, setPendingPromise] =
    useOptimistic<QueryPromise<TResult> | null>(null);
  const [isPendingTransition, startPendingTransition] = useTransition();

  const mutation = queryClient.addMutation<TParams, TResult>(
    mutationDefinition
  );

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
  let error: QueryPromise<TResult>["reason"] | null = null;
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
