import { use, useMemo } from "react";
import type { QueryClient } from "../QueryClient";
import { QueryContext } from "../react/QueryProvider";
import { StatusIcons } from "./constants";

export function useDebugFormattedQuery(queryClient?: QueryClient) {
  const client = queryClient ?? use(QueryContext)?.queryClient;

  if (client === undefined) {
    throw new Error("No query client found");
  }

  return useMemo(() => {
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
      [`${StatusIcons.total} total`]: {
        count: allQueries.length,
        queries: allQueries,
      },
      [`${StatusIcons.stale} stale`]: {
        count: staleQueries.length,
        queries: staleQueries,
      },
      [`${StatusIcons.pending} pending`]: {
        count: pendingQueries.length,
        queries: pendingQueries,
      },
      [`${StatusIcons.fetching} fetching`]: {
        count: fetchingQueries.length,
        queries: fetchingQueries,
      },
      [`${StatusIcons.fulfilled} fulfilled`]: {
        count: fulfilledQueries.length,
        queries: fulfilledQueries,
      },
      [`${StatusIcons.rejected} rejected`]: {
        count: rejectedQueries.length,
        queries: rejectedQueries,
      },
    };
  }, [client]);
}
