import {
  createContext,
  type PropsWithChildren,
  useState,
  use,
  useTransition,
  useDeferredValue,
  useEffect,
  useId,
  useRef,
} from "react";
import { noop } from "./utils";
import { QueryClient, type QueryClientOptions } from "./QueryClient";
import type { RetryConfig } from "./Retrier";
import { useEvent } from "../useEvent";
import { AnyKey, Query } from "./Query";

/**
 * Context value for the query provider
 */
export interface QueryContextValue {
  queryClient: QueryClient;
  isQueryClientPending: boolean;
  subscribe: <Key extends AnyKey, TData = unknown>(
    query: Query<Key, TData>
  ) => () => void;
  unsubscribe: <Key extends AnyKey, TData = unknown>(
    query: Query<Key, TData>
  ) => void;
}

/**
 * Query Context - exposed for testing purposes.
 * In production code, use the useQuery hook instead of accessing this directly.
 */
const defaultQueryClient = new QueryClient();
export const QueryContext = createContext<QueryContextValue>({
  queryClient: defaultQueryClient,
  isQueryClientPending: false,
  subscribe: () => noop,
  unsubscribe: noop,
});

/**
 * Props for {@link QueryProvider}
 */
export interface QueryProviderProps extends PropsWithChildren {
  queryCacheOptions?: QueryClientOptions;
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
  queryCacheOptions = {},
}: QueryProviderProps) {
  const [isPending, startTransition] = useTransition();
  const subscriptions = useRef<Map<string, () => void>>(new Map());
  const [queryClient, setQueryClient] = useState(() => {
    return new QueryClient({
      ...queryCacheOptions,
      onChange: (newInstance) => {
        startTransition(() => {
          setQueryClient(newInstance);
        });
      },
    });
  });

  const subscribe = useEvent(
    <Key extends AnyKey, TData = unknown>(query: Query<Key, TData>) => {
      if (typeof query.serializedKey !== "string") {
        throw new Error("Query key mismatch");
      }
      const maybeSubscription = subscriptions.current.get(query.serializedKey);
      if (maybeSubscription !== undefined) {
        return maybeSubscription;
      }

      const queryUnsubscribe = query.subscribe(noop);
      const unsubscribe = () => {
        queryUnsubscribe();
        subscriptions.current.delete(query.serializedKey);
      };
      subscriptions.current.set(query.serializedKey, unsubscribe);

      return unsubscribe;
    }
  );

  const unsubscribe = useEvent(
    <Key extends AnyKey, TData = unknown>(query: Query<Key, TData>) => {
      const maybeUnsubscribe = subscriptions.current.get(query.serializedKey);

      if (maybeUnsubscribe === undefined) {
        return;
      }

      maybeUnsubscribe();
    }
  );

  return (
    <QueryContext
      value={{
        queryClient,
        isQueryClientPending: isPending,
        subscribe,
        unsubscribe,
      }}
    >
      {children}
    </QueryContext>
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
  promise: Promise<PromiseValue> | null;
  isPending: boolean;
} {
  const { key, queryFn, gcTime, staleTime, retry, retryDelay } = options;
  const { queryClient, isQueryClientPending, subscribe } = useQueryContext();
  const queryFnStable = useEvent(queryFn);

  // Add or get query from cache (staleness check happens inside addQuery)
  const query = queryClient.addQuery<Key, PromiseValue>({
    key,
    queryFn: queryFnStable,
    gcTime,
    staleTime,
    retry,
    retryDelay,
  });

  // Subscribe to query changes
  const unsubscribeQuery = subscribe(query);
  useEffect(() => unsubscribeQuery, [unsubscribeQuery]);

  const deferredPromise = useDeferredValue(query.promise);
  const isPending = deferredPromise !== query.promise;

  return {
    promise: deferredPromise,
    isPending: isQueryClientPending || isPending,
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

  const mutate = useEvent(async (variables: Variables): Promise<Data> => {
    return new Promise<Data>((resolve, reject) => {
      startTransition(async () => {
        setError(null);

        await mutationFn(variables)
          .then((result) => {
            // Invalidate queries after successful mutation
            if (invalidateQueries.length > 0) {
              for (const queryKey of invalidateQueries) {
                queryClient.invalidate(queryKey);
              }
            }

            resolve(result);
          })
          .catch((err) => {
            const errorObj =
              err instanceof Error ? err : new Error(String(err));
            setError(errorObj);
            reject(errorObj);
          });
      });
    });
  });

  return { mutate, isPending, error };
}
