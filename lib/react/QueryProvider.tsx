import {
  createContext,
  type PropsWithChildren,
  useState,
  use,
  startTransition,
  useDebugValue,
} from "react";
import { QueryClient, type QueryClientContext } from "../QueryClient";
import { eventEmitter } from "../EventEmitter";
import { type DependencyGraph } from "../DependencyGraph";
import { useDebugFormattedQuery } from "../devtools/useDebugFormattedQuery";

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
} & (
  | { queryClient: QueryClient; graph?: never }
  | { queryClient?: never; graph: DependencyGraph }
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
export function QueryProvider(props: QueryProviderProps) {
  const queryClient = useQueryProviderFactory(props);
  return <QueryContext value={{ queryClient }}>{props.children}</QueryContext>;
}

function useQueryProviderFactory(props: QueryProviderProps) {
  const [queryClient, setQueryClient] = useState(() => {
    const onChange = (newInstance: QueryClient) => {
      eventEmitter.emit("client:change", { client: newInstance });
      startTransition(() => {
        setQueryClient(newInstance);
      });
    };

    if (props.queryClient !== undefined) {
      props.queryClient.setOptions({ onChange });
      return props.queryClient;
    }

    return new QueryClient({
      graph: props.graph,
      onChange,
      context: props.context,
    });
  });

  queryClient.setOptions({ context: props.context });

  if (import.meta.env.DEV) {
    useDebugValue(useDebugFormattedQuery(queryClient));
  }

  return queryClient;
}

export function useQueryContext(): QueryContextValue {
  const context = use(QueryContext);
  if (!context) {
    throw new Error("useQueryContext must be used within a QueryProvider");
  }
  if (import.meta.env.DEV) {
    useDebugValue(useDebugFormattedQuery(context.queryClient));
  }
  return context;
}
