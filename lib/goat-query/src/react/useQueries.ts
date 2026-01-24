import { useEffect } from "react";

import { noop } from "../utils";

import { useQueryContext } from "./QueryProvider";
import { type UseQueryOptions } from "./useQuery";

export function useQueries(queries: readonly UseQueryOptions<any, any>[]) {
  const { queryClient } = useQueryContext();

  const queryInstances = queries.map((query) => {
    const queryInstance = queryClient.addQuery(query.query, query.params, {
      prefetch: true,
    });

    const queryState = queryInstance.getState();
    return {
      queryInstance,
      isPending: queryState.status === "pending",
      isFetching: queryState.fetchStatus === "fetching",
      isSuccess: queryState.status === "fulfilled",
      isError: queryState.status === "rejected",
      state: queryState,
      promise: queryInstance.promise,
      refetch: () => queryInstance.refetch(),
    };
  });

  useEffect(() => {
    const subscriptions = queryInstances.map(({ queryInstance }) => queryInstance.subscribe(noop));
    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, queryInstances);

  const isPending = queryInstances.some(({ isPending }) => isPending);
  const isFetching = queryInstances.some(({ isFetching }) => isFetching);
  const isSuccess = queryInstances.every(({ isSuccess }) => isSuccess);
  const isError = queryInstances.some(({ isError }) => isError);

  return {
    isPending,
    isFetching,
    isSuccess,
    isError,
    queries: queryInstances,
  };
}
