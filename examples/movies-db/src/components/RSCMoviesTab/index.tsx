/**
 * RSC Movies Tab
 *
 * Renders movie list via React Server Components from dedicated worker runtime.
 */

import { Suspense } from "react";
import { RuntimeProvider, rsc } from "@lib/rsc-prism/react";
import type { TabProps } from "../shared/types";
import { SearchBox } from "../shared";
import { MovieList } from "./worker-components";

const MoviesListRSC = rsc(MovieList);

export default function RSCMoviesTab({ formState, onFormStateChange, api, devtools }: TabProps) {
  return (
    <RSCMoviesTabContent
      devtools={devtools}
      formState={formState}
      onFormStateChange={onFormStateChange}
      api={api}
    />
  );
}

function RSCMoviesTabContent({ formState, onFormStateChange }: TabProps) {
  const searchQueryValue = formState.get("searchQuery");
  const searchQuery = typeof searchQueryValue === "string" ? searchQueryValue : "";
  const limit = Number(formState.get("movieLimit") ?? 100);

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
          <RuntimeProvider>
            <MoviesListRSC searchQuery={searchQuery} limit={limit} />
          </RuntimeProvider>
        </Suspense>
      </div>
    </div>
  );
}
