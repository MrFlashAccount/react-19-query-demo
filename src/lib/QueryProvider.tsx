import {
  createContext,
  type PropsWithChildren,
  useState,
  use,
  useEffect,
  useTransition,
  useDeferredValue,
} from "react";
import { useEvent } from "../useEvent";
import { QueryCache, type PromiseEntry } from "./QueryCache";
import { BackgroundRefetch } from "./BackgroundRefetch";
import type { RetryConfig } from "./Retrier";

/**
 * Context value for the query provider
 */
export interface QueryContextValue {
  queryCache: QueryCache;
  backgroundRefetch: BackgroundRefetch;
}

/**
 * Query Context - exposed for testing purposes.
 * In production code, use the useQuery hook instead of accessing this directly.
 */
const defaultQueryCache = new QueryCache();
export const QueryContext = createContext<QueryContextValue>({
  queryCache: defaultQueryCache,
  backgroundRefetch: new BackgroundRefetch({ queryCache: defaultQueryCache }),
});

/**
 * Props for {@link QueryProvider}
 */
export interface QueryProviderProps extends PropsWithChildren {
  queryCache: QueryCache;
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
 * <QueryProvider queryCache={new QueryCache()}>
 *   <App />
 * </QueryProvider>
 * ```
 */
export function QueryProvider({ children, queryCache }: QueryProviderProps) {
  const [backgroundRefetch] = useState(() => {
    const bgRefetch = new BackgroundRefetch({ queryCache });
    queryCache.setBackgroundRefetch(bgRefetch);
    return bgRefetch;
  });

  useEffect(() => {
    return () => {
      backgroundRefetch.stop();
    };
  }, [backgroundRefetch]);

  return (
    <QueryContext value={{ queryCache, backgroundRefetch }}>
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

export function useQueryCache(): QueryCache {
  return use(QueryContext).queryCache;
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
 *   - New instances of the query mount (handled by QueryCache.addPromise)
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
  promise: PromiseEntry<PromiseValue>;
  isPending: boolean;
} {
  const { key, queryFn, gcTime, staleTime, retry, retryDelay } = options;
  const queryFnCallback = useEvent(queryFn);
  const deferredKey = useDeferredValue(key);
  const isPending = key !== deferredKey;

  const { queryCache } = use(QueryContext);

  // Add or get promise from cache (staleness check happens inside addPromise)
  const promiseEntry = queryCache.addPromise<Key, PromiseValue>({
    key: deferredKey,
    queryFn: queryFnCallback,
    gcTime,
    staleTime,
    retry,
    retryDelay,
  });

  // Track subscription lifecycle (also handles background refetch registration)
  useEffect(() => {
    queryCache.subscribe(deferredKey);

    return () => {
      queryCache.unsubscribe(deferredKey);
    };
  }, [JSON.stringify(deferredKey)]);

  return { promise: promiseEntry, isPending };
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
  const mutationFnCallback = useEvent(mutationFn);

  const { queryCache } = use(QueryContext);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<Error | null>(null);

  const mutate = useEvent(async (variables: Variables): Promise<Data> => {
    return new Promise<Data>((resolve, reject) => {
      startTransition(async () => {
        setError(null);

        await mutationFnCallback(variables)
          .then((result) => {
            // Invalidate queries after successful mutation
            if (invalidateQueries.length > 0) {
              for (const queryKey of invalidateQueries) {
                queryCache.invalidate(queryKey);
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
