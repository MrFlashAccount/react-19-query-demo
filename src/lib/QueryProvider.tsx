import {
  createContext,
  type PropsWithChildren,
  useState,
  use,
  useTransition,
  useEffect,
  startTransition,
} from "react";
import { QueryClient, type QueryClientOptions } from "./QueryClient";
import type { RetryConfig } from "./Retrier";
import { createMeasurer, noop } from "./utils";
import type { QueryState } from "./Query";
import {
  type EventEmitter,
  type EventsMap,
  eventEmitter,
} from "./EventEmitter";

/**
 * Context value for the query provider
 */
export interface QueryContextValue {
  queryClient: QueryClient;
  withMeasure: ReturnType<typeof createMeasurer>;
}

/**
 * Query Context - exposed for testing purposes.
 * In production code, use the useQuery hook instead of accessing this directly.
 */
const defaultQueryClient = new QueryClient();
export const QueryContext = createContext<QueryContextValue>({
  queryClient: defaultQueryClient,
  withMeasure: noop as ReturnType<typeof createMeasurer>,
});

/**
 * Props for {@link QueryProvider}
 */
export interface QueryProviderProps extends PropsWithChildren {
  queryCacheOptions?: QueryClientOptions;
  queryClient?: QueryClient;
  eventEmitter?: EventEmitter<EventsMap>;
}

/**
 * Query Provider component that manages promise caching with garbage collection.
 *
 * Features:
 * - Caches promises by key
 * - Tracks active subscriptions per cache entry
 * - Only triggers GC when there are no active subscriptions
 * - Cancels GC timer when new subscriptions are added
 * - Background refetching on focus and reconnect
 *
 * @example
 * ```tsx
 * <QueryProvider queryCacheOptions={{}}>
 *   <App />
 * </QueryProvider>
 * ```
 */
export function QueryProvider({
  children,
  queryClient: initialQueryClient,
  queryCacheOptions = {},
}: QueryProviderProps) {
  const withMeasure = createMeasurer({
    trackGroup: "Custom Library 🐐",
    properties: [["QueryClient", JSON.stringify(queryCacheOptions)]],
    color: "primary",
  });

  const [queryClient, setQueryClient] = useState(() => {
    const onChange = (newInstance: QueryClient) => {
      eventEmitter.emit("client:change", { client: newInstance });
      startTransition(() => {
        setQueryClient(newInstance);
      });
    };

    if (initialQueryClient !== undefined) {
      initialQueryClient.setOptions({
        onChange,
        context: { measurer: withMeasure },
      });
      return initialQueryClient;
    }

    return new QueryClient({
      ...queryCacheOptions,
      onChange,
      context: { measurer: withMeasure },
    });
  });

  return (
    <QueryContext value={{ queryClient, withMeasure }}>{children}</QueryContext>
  );
}

/**
 * Options for useQuery hook
 */
export interface UseQueryOptions<
  Key extends Array<unknown>,
  PromiseValue extends unknown
> {
  /** The cache key */
  key: Key;
  /** Function that returns a promise to fetch data */
  queryFn: (key: Key) => Promise<PromiseValue>;
  /** Time in milliseconds after which the cache entry will be removed. Default: Infinity */
  gcTime?: number;
  /** Time in milliseconds until data becomes stale. Can be 'static' or Infinity. Default: 0 */
  staleTime?: number | "static";
  /** Retry configuration - number of retries, boolean, or custom function. Default: true (3 retries) */
  retry?: RetryConfig;
  /** Delay between retries in milliseconds. Default: 0 */
  retryDelay?: number | ((failureCount: number, error: unknown) => number);
}

export function useQueryClient(): QueryClient {
  return use(QueryContext).queryClient;
}

export function useQueryContext(): QueryContextValue {
  return use(QueryContext);
}

/**
 * Hook to fetch and cache data with automatic garbage collection.
 *
 * Automatically manages subscriptions:
 * - Subscribes on mount
 * - Unsubscribes on unmount
 * - Re-subscribes when key changes
 *
 * GC behavior:
 * - GC timer only runs when subscriptions = 0
 * - Timer is cancelled when component mounts
 * - Timer starts when component unmounts
 *
 * Stale behavior:
 * - Stale queries are refetched automatically in the background when:
 *   - New instances of the query mount (handled by QueryClient.addQuery)
 *   - The window is refocused (handled by BackgroundRefetch)
 *   - The network is reconnected (handled by BackgroundRefetch)
 *
 * @example
 * ```tsx
 * function UserProfile({ userId }) {
 *   const promise = useQuery({
 *     key: ['user', userId],
 *     queryFn: () => fetchUser(userId),
 *     gcTime: 5000, // Cache for 5 seconds after unmount
 *     staleTime: 2 * 60 * 1000 // Fresh for 2 minutes
 *   })
 *   const user = use(promise)
 *   return <div>{user.name}</div>
 * }
 * ```
 */
export function useQuery<
  const Key extends Array<unknown>,
  PromiseValue extends unknown
>(
  options: UseQueryOptions<Key, PromiseValue>
): {
  promise: Promise<PromiseValue>;
  isPending: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  isError: boolean;
  state: Readonly<QueryState<PromiseValue>>;
} {
  const { key, queryFn, gcTime, staleTime, retry, retryDelay } = options;
  const { queryClient } = useQueryContext();

  // Add or get query from cache (staleness check happens inside addQuery)
  const query = queryClient.addQuery<Key, PromiseValue>({
    key,
    queryFn,
    gcTime,
    staleTime,
    retry,
    retryDelay,
    prefetch: true,
  });

  const queryState = query.getState();
  const isPending = queryState.status === "pending";
  const isFetching = queryState.fetchStatus === "fetching";
  const isSuccess = queryState.status === "success";
  const isError = queryState.status === "error";

  // Subscribe to query changes
  useEffect(() => query.subscribe(() => {}), [query]);

  return {
    isPending,
    isFetching,
    isSuccess,
    isError,
    state: queryState,
    promise: query.promise,
  };
}

/**
 * Options for useMutation hook
 */
export interface UseMutationOptions<
  Variables extends unknown,
  Data extends unknown
> {
  /** Function that performs the mutation */
  mutationFn: (variables: Variables) => Promise<Data>;
  /** Array of query keys to invalidate after successful mutation */
  invalidateQueries?: Array<Array<unknown>>;
}

/**
 * Result returned by useMutation hook
 */
export interface UseMutationResult<
  Variables extends unknown,
  Data extends unknown
> {
  /** Function to trigger the mutation */
  mutate: (variables: Variables) => Promise<Data>;
  /** Whether the mutation is currently running */
  isPending: boolean;
  /** Error from the last mutation attempt, or null if no error */
  error: Error | null;
}

/**
 * Hook to perform mutations with automatic query invalidation.
 *
 * Features:
 * - Wraps mutation in async transition
 * - Automatically invalidates specified queries after successful mutation
 * - Tracks loading and error states
 * - Stable mutate function that doesn't cause re-renders
 * - Returns data directly from the mutate promise
 *
 * @example
 * ```tsx
 * function AddMovie() {
 *   const { mutate, isPending, error } = useMutation({
 *     mutationFn: (movie: Movie) => createMovie(movie),
 *     invalidateQueries: [['movies']]
 *   })
 *
 *   const handleSubmit = async (movie: Movie) => {
 *     const result = await mutate(movie)
 *     console.log('Created:', result)
 *   }
 *
 *   return (
 *     <form onSubmit={(e) => {
 *       e.preventDefault()
 *       handleSubmit(movie)
 *     }}>
 *       {isPending && <Spinner />}
 *       {error && <Error message={error.message} />}
 *     </form>
 *   )
 * }
 * ```
 */
export function useMutation<Variables extends unknown, Data extends unknown>(
  options: UseMutationOptions<Variables, Data>
): UseMutationResult<Variables, Data> {
  const { mutationFn, invalidateQueries = [] } = options;

  const { queryClient } = use(QueryContext);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<Error | null>(null);

  const mutate = async (variables: Variables): Promise<Data> => {
    const start = performance.now();
    const scope = eventEmitter.createScope();
    scope.emit("mutation:start", { variables });
    const executionScope = scope.createChildScope();
    const executionStart = performance.now();
    executionScope.emit("mutation:execution:start", { variables });

    return new Promise<Data>((resolve, reject) => {
      startTransition(async () => {
        setError(null);

        await mutationFn(variables)
          .then(async (result) => {
            executionScope.emit("mutation:execution:success", {
              variables,
              duration: performance.now() - executionStart,
              data: result,
            });
            // Invalidate queries after successful mutation
            if (invalidateQueries.length > 0) {
              const queries = invalidateQueries.map((k) => JSON.stringify(k));
              const invalidationScope = scope.createChildScope();
              invalidationScope.emit("mutation:invalidation:start", {
                variables,
                queries,
              });

              const invalidationStart = performance.now();

              const invalidationPromise = new Promise<void>(
                (resolve, reject) => {
                  startTransition(async () => {
                    try {
                      await Promise.all(
                        invalidateQueries.map((queryKey) =>
                          queryClient.invalidate(queryKey, {
                            parentScopeId: invalidationScope.scopeId,
                          })
                        )
                      );
                      resolve();
                    } catch (error) {
                      reject(error);
                    }
                  });
                }
              );

              try {
                await invalidationPromise;
                invalidationScope.emit("mutation:invalidation:success", {
                  variables,
                  queries,
                  duration: performance.now() - invalidationStart,
                });
              } catch (invError) {
                invalidationScope.emit("mutation:invalidation:error", {
                  variables,
                  queries,
                  duration: performance.now() - invalidationStart,
                  error: invError,
                });
                throw invError;
              }
            }

            scope.emit("mutation:success", {
              variables,
              duration: performance.now() - start,
              data: result,
            });

            resolve(result);
          })
          .catch((err) => {
            const errorObj =
              err instanceof Error ? err : new Error(String(err));
            setError(errorObj);

            executionScope.emit("mutation:execution:error", {
              variables,
              duration: performance.now() - executionStart,
              error: errorObj,
            });

            scope.emit("mutation:error", {
              variables,
              duration: performance.now() - start,
              error: errorObj,
            });

            reject(errorObj);
          });
      });
    });
  };

  return { mutate, isPending, error };
}
