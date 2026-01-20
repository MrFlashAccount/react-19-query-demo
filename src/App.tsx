import { useState, lazy, useTransition } from "react";
import { TabSelector } from "./components/shared";
import { searchMovies, getMovieById, updateMovieRating } from "./api/movieApi";
import type { MovieApi } from "./api/types";
import { traced } from "lib/tracing";
import type { ISpan } from "lib/tracing";

const LazyTanStackQueryTab = lazy(
  () => import("./components/TanStackQueryTab")
);
const LazyCustomLibraryTab = lazy(
  () => import("./components/CustomLibraryTab")
);
const LazyLagRadar = lazy(() =>
  import("./components/shared/LagRadar").then((d) => ({ default: d.LagRadar }))
);

const STRESS_DEPTH = 6;
const STRESS_BREADTH = 4;
const STRESS_BRANCHES = 3;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const runBranch = async (
  parent: ISpan,
  depth: number,
  breadth: number,
  path: string
): Promise<void> => {
  const withSpan = traced(
    async (span: ISpan) => {
      await sleep(2 + Math.random() * 10);

      if (depth <= 0) {
        return;
      }

      const tasks = Array.from({ length: breadth }, (_, index) =>
        runBranch(span, depth - 1, breadth, `${path}.${index}`)
      );
      await Promise.all(tasks);
      await sleep(2 + Math.random() * 10);
    },
    {
      name: `stress:node:${path}`,
      payload: { depth, breadth, path },
      meta: { color: depth % 2 === 0 ? "secondary" : "tertiary" },
      parentSpan: parent,
    }
  );

  await withSpan();
};

const runTracingStressTest = async (): Promise<void> => {
  const rootSpan = traced(
    async (root) => {
      await sleep(5 + Math.random() * 15);

      const branches = Array.from({ length: STRESS_BRANCHES }, (_, index) =>
        runBranch(root, STRESS_DEPTH, STRESS_BREADTH, `root-${index}`)
      );
      await Promise.all(branches);

      const tailSpan = traced(
        async () => {
          for (let i = 0; i < 5; i += 1) {
            await sleep(4 + i + Math.random() * 6);
          }
        },
        {
          name: "stress:tail",
          payload: { phase: "tail" },
          meta: { color: "secondary" },
          parentSpan: root,
        }
      );

      await tailSpan();
    },
    {
      name: "stress:test",
      payload: {
        depth: STRESS_DEPTH,
        breadth: STRESS_BREADTH,
        branches: STRESS_BRANCHES,
      },
      meta: { color: "primary", description: "Tracing stress test" },
    }
  );

  await rootSpan();
};

function TracingStressTest() {
  const [transitioning, startTransition] = useTransition();
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setError(null);
    setLastDurationMs(null);

    const start = performance.now();

    try {
      await runTracingStressTest();
      setLastDurationMs(Math.round(performance.now() - start));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => startTransition(handleRun)}
        disabled={transitioning}
        className="rounded-full border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {transitioning
          ? "Running tracing stress test..."
          : "Run tracing stress test"}
      </button>
      <div className="text-[11px] text-gray-400">
        {lastDurationMs !== null && `Last run: ${lastDurationMs}ms`}
        {error && `Error: ${error}`}
        {lastDurationMs === null && !error && "Spawns deep async spans"}
      </div>
    </div>
  );
}

/**
 * Main application component with tabbed interface
 * Compares custom query library implementation with TanStack Query
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<"custom" | "tanstack" | "unset">(
    "custom"
  );

  const [formState, setFormState] = useState(() => {
    const formData = new FormData();

    formData.set("movieLimit", "100");
    formData.set("gcTimeout", "60000");
    formData.set("searchQuery", "");
    formData.set("showDevtools", "false");
    formData.set("showLagRadar", "false");

    return formData;
  });

  const showLagRadar = formState.get("showLagRadar") === "true";

  const updateFormState = (formData: FormData) => {
    setFormState(formData);
  };

  const api: MovieApi = {
    getMovieById,
    searchMovies,
    updateMovieRating,
  };

  return (
    <>
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
          <div className="mt-6 flex justify-center">
            <TracingStressTest />
          </div>
        </div>

        {(() => {
          switch (activeTab) {
            case "custom":
              return (
                <LazyCustomLibraryTab
                  devtools={formState.get("showDevtools") === "true"}
                  formState={formState}
                  onFormStateChange={updateFormState}
                  api={api}
                />
              );
            case "tanstack":
              return (
                <LazyTanStackQueryTab
                  devtools={formState.get("showDevtools") === "true"}
                  formState={formState}
                  onFormStateChange={updateFormState}
                  api={api}
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
      {showLagRadar && <LazyLagRadar />}
    </>
  );
}
