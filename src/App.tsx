import { useState, Suspense } from "react";
import { QueryProvider, QueryCache } from "./lib";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GitHubCorner from "react-github-corner";
import { TabSelector } from "./components/shared/TabSelector";
import { CustomLibraryTab } from "./components/CustomLibraryTab";
import { TanStackQueryTab } from "./components/TanStackQueryTab";

/**
 * Main application component with tabbed interface
 * Compares custom query library implementation with TanStack Query
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<"custom" | "tanstack">("custom");
  const queryCache = new QueryCache({
    debug: { enabled: false, showTimestamps: true, verboseData: false },
  });

  const tanStackQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 60_000,
      },
    },
  });

  return (
    <>
      <GitHubCorner
        href="https://github.com/MrFlashAccount/react-19-query-demo"
        bannerColor="#000"
        octoColor="#fff"
        size={100}
        direction="right"
      />
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
          <QueryProvider queryCache={queryCache}>
            <Suspense
              fallback={
                <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
                  <div className="animate-spin h-8 w-8 md:h-10 md:w-10 border-3 border-gray-300 border-t-black rounded-full mb-4" />
                  <p className="text-sm md:text-base text-gray-500">
                    Loading movies...
                  </p>
                </div>
              }
            >
              <CustomLibraryTab />
            </Suspense>
          </QueryProvider>
        ) : (
          <QueryClientProvider client={tanStackQueryClient}>
            <Suspense
              fallback={
                <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
                  <div className="animate-spin h-8 w-8 md:h-10 md:w-10 border-3 border-gray-300 border-t-black rounded-full mb-4" />
                  <p className="text-sm md:text-base text-gray-500">
                    Loading movies...
                  </p>
                </div>
              }
            >
              <TanStackQueryTab />
            </Suspense>
          </QueryClientProvider>
        )}
      </div>
    </>
  );
}
