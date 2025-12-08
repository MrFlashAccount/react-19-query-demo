import type { QueryClient } from "../QueryClient";
import { useQueryContext } from "../react/QueryProvider";

export function useDebugFormattedQuery(queryClient?: QueryClient) {
  const client = queryClient ?? useQueryContext().queryClient;
  const cache = client.getCache();
  const queryDefinitions = Array.from(cache.entries()).map(
    ([definition]) => definition
  );
  const allQueries = cache.findByDefinitions(queryDefinitions);
  const pendingQueries = allQueries.filter(
    (query) => query.getState().status === "pending"
  );
  const fetchingQueries = allQueries.filter(
    (query) => query.getState().fetchStatus === "fetching"
  );
  const fulfilledQueries = allQueries.filter(
    (query) => query.getState().status === "fulfilled"
  );
  const rejectedQueries = allQueries.filter(
    (query) => query.getState().status === "rejected"
  );
  const staleQueries = allQueries.filter((query) => query.isStale());
  return {
    "🔍 total": {
      count: allQueries.length,
      queries: allQueries,
    },
    "🕛 stale": {
      count: staleQueries.length,
      queries: staleQueries,
    },
    "📲 pending": {
      count: pendingQueries.length,
      queries: pendingQueries,
    },
    "🔄 fetching": {
      count: fetchingQueries.length,
      queries: fetchingQueries,
    },
    "✅ fulfilled": {
      count: fulfilledQueries.length,
      queries: fulfilledQueries,
    },
    "❌ rejected": {
      count: rejectedQueries.length,
      queries: rejectedQueries,
    },
  };
}
