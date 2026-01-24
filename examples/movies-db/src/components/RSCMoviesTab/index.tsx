/**
 * RSC Movies Tab
 *
 * Renders movie list via React Server Components from service worker.
 * Uses goat-query for state management, same pattern as CustomLibraryTab.
 */

// IMPORTANT: Import webpack shim FIRST - before any react-server-dom-webpack imports
import "@lib/rsc-service-worker-bff/rsc/webpack-shim";

import { lazy, use, Suspense } from "react";
import { registerClientModule } from "@lib/rsc-service-worker-bff/rsc/client-only";
import type { TabProps } from "../shared/types";
import { SearchBox } from "../shared";
import { appGraph, rscMoviesQuery } from "../../queries";
import * as ClientComponents from "./client-components";

const { QueryProvider, useQuery, QueryClient } = await import("@lib/goat-query/react");
const LazyDevtools = lazy(() =>
  import("@lib/goat-query/devtools").then((d) => ({ default: d.QueryDevtools })),
);

// Register client components so RSC can hydrate them
registerClientModule("rsc-movies-client", ClientComponents);

const queryClient = new QueryClient({ graph: appGraph });

export default function RSCMoviesTab({ formState, onFormStateChange, api, devtools }: TabProps) {
  return (
    <QueryProvider queryClient={queryClient} context={{ api }}>
      <RSCMoviesTabContent
        devtools={devtools}
        formState={formState}
        onFormStateChange={onFormStateChange}
        api={api}
      />
      {devtools && <LazyDevtools />}
    </QueryProvider>
  );
}

function RSCMoviesTabContent({ formState, onFormStateChange }: TabProps) {
  const searchQueryValue = formState.get("searchQuery");
  const searchQuery = typeof searchQueryValue === "string" ? searchQueryValue : "";
  const limit = Number(formState.get("movieLimit") ?? 100);

  const { promise } = useQuery({
    query: rscMoviesQuery,
    params: { searchQuery, limit },
  });

  const content = use(promise);

  return (
    <div className="flex flex-col items-center min-h-screen px-4 pb-20 md:pb-60">
      <SearchBox formState={formState} onFormStateChange={onFormStateChange} />

      <div className="w-full max-w-6xl">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin h-8 w-8 border-3 border-gray-300 border-t-black rounded-full mb-4" />
              <p className="text-sm text-gray-500">Loading movies from RSC...</p>
            </div>
          }
        >
          {content}
        </Suspense>
      </div>
    </div>
  );
}
