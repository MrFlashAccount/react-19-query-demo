import { useState, Suspense, lazy } from "react";
import { QueryProvider, QueryCache } from "./lib";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TabSelector } from "./components/shared/TabSelector";

const LazyGitHubCorner = lazy(() => import("react-github-corner"));
const LazyLagRadar = lazy(() => import("react-lag-radar"));

const LazyTanStackQueryTab = lazy(() =>
  import("./components/TanStackQueryTab").then((mod) => ({
    default: mod.TanStackQueryTab,
  }))
);
const LazyCustomLibraryTab = lazy(() =>
  import("./components/CustomLibraryTab").then((mod) => ({
    default: mod.CustomLibraryTab,
  }))
);

/**
 * Main application component with tabbed interface
 * Compares custom query library implementation with TanStack Query
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<"custom" | "tanstack">("custom");
  const [movieLimit, setMovieLimit] = useState(100);

  const queryCache = new QueryCache({ debug: { enabled: false } });

  const tanStackQueryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 60_000 } },
  });

  return (
    <QueryProvider queryCache={queryCache}>
      <QueryClientProvider client={tanStackQueryClient}>
        <Suspense fallback={<Loading />}>
          <LazyGitHubCorner
            href="https://github.com/MrFlashAccount/react-19-query-demo"
            bannerColor="#000"
            octoColor="#fff"
            size={100}
            direction="left"
          />

          <div className="fixed bottom-4 left-4 z-50 bg-gray-900 rounded-full shadow-lg p-2 border-2 border-gray-700">
            <LazyLagRadar size={120} />
          </div>

          <div className="min-h-screen bg-white">
            {/* Header */}
            <div className="text-center pt-12 mb-8 md:pt-16 md:mb-12">
              <h1 className="text-3xl md:text-5xl font-bold mb-2 tracking-tight">
                <span className="text-black">Movie</span>
                <span className="text-gray-400">DB</span>
              </h1>
              <p className="text-gray-500 text-xs md:text-sm mb-6">
                Search thousands of movies
              </p>
              <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            {activeTab === "custom" ? (
              <LazyCustomLibraryTab
                movieLimit={movieLimit}
                onMovieLimitChange={setMovieLimit}
              />
            ) : (
              <LazyTanStackQueryTab
                movieLimit={movieLimit}
                onMovieLimitChange={setMovieLimit}
              />
            )}
          </div>
        </Suspense>
      </QueryClientProvider>
    </QueryProvider>
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
