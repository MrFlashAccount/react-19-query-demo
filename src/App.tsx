import { useState, Suspense, lazy } from "react";
import { TabSelector } from "./components/shared/TabSelector";

const LazyTanStackQueryTab = lazy(
  () => import("./components/TanStackQueryTab")
);
const LazyCustomLibraryTab = lazy(
  () => import("./components/CustomLibraryTab")
);
const LazyLocalTanStackQueryTab = lazy(
  // @ts-expect-error - no declaration file supposed
  () => import("../lib/local-tanstack-query.js")
);

/**
 * Main application component with tabbed interface
 * Compares custom query library implementation with TanStack Query
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<
    "custom" | "tanstack" | "local-tanstack" | "unset"
  >("custom");
  const [movieLimit, setMovieLimit] = useState(1000);

  return (
    <Suspense fallback={<Loading />}>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="text-center pt-12 mb-12 md:pt-16 md:mb-12">
          <h1 className="text-3xl md:text-5xl font-bold mb-2 tracking-tight">
            <span className="text-black">Movie</span>
            <span className="text-gray-400">DB</span>
          </h1>
          <p className="text-gray-500 text-xs md:text-sm mb-6">
            Search thousands of movies
          </p>
          <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {(() => {
          switch (activeTab) {
            case "custom":
              return (
                <LazyCustomLibraryTab
                  movieLimit={movieLimit}
                  onMovieLimitChange={setMovieLimit}
                />
              );
            case "tanstack":
              return (
                <LazyTanStackQueryTab
                  movieLimit={movieLimit}
                  onMovieLimitChange={setMovieLimit}
                />
              );
            case "local-tanstack":
              return (
                <LazyLocalTanStackQueryTab
                  movieLimit={movieLimit}
                  onMovieLimitChange={setMovieLimit}
                />
              );
            default:
              return (
                <div className="flex flex-col items-center justify-center py-20 px-4">
                  <div className="animate-pulse h-6 w-6 border-2 border-gray-300 border-t-black rounded-full mb-4" />
                  <p className="text-gray-500 text-sm">
                    Cleaning up from the last tab...
                  </p>
                </div>
              );
          }
        })()}
      </div>
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="animate-spin h-8 w-8 md:h-10 md:w-10 border-3 border-gray-300 border-t-black rounded-full mb-4" />
      <p className="text-sm md:text-base text-gray-500">Loading movies...</p>
    </div>
  );
}
