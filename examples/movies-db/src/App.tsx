import type { MovieApi } from "./api/types";
import type { TabId } from "./components/shared/TabSelector";
import { useState, lazy, useTransition, useEffect, useRef } from "react";

import { searchMovies, getMovieById, updateMovieRating } from "./api/movieApi";
import { TabSelector } from "./components/shared";

const LazyTanStackQueryTab = lazy(() => import("./components/TanStackQueryTab"));
const LazyCustomLibraryTab = lazy(() => import("./components/CustomLibraryTab"));
const LazyRSCMoviesTab = lazy(() => import("./components/RSCMoviesTab"));
const LazyLagRadar = lazy(() =>
  import("./components/shared/LagRadar").then((d) => ({ default: d.LagRadar })),
);

const STRESS_DEPTH = 5;
const STRESS_BREADTH = 5;
const STRESS_BRANCHES = 1;
const STRESS_TASKS = 25;

const TOTAL_INVOCATIONS =
  (STRESS_BRANCHES * ((STRESS_BREADTH ** (STRESS_DEPTH + 1) - 1) / (STRESS_BREADTH - 1)) + 2) *
  STRESS_TASKS;

interface StressTestResult {
  untracedMs: number;
  tracedMs: number;
}

// TODO: move into a separate project/example
// @ts-ignore
// oxlint-disable-next-line no-unused-vars
function TracingStressTest() {
  const [transitioning, startTransition] = useTransition();
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL("./stressTest.worker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current.onmessage = (event) => {
      const response = event.data;
      if (response.type === "complete") {
        setResult({ untracedMs: response.untracedMs, tracedMs: response.tracedMs });
      } else if (response.type === "error") {
        setError(response.error);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handleRun = () => {
    setError(null);
    setResult(null);

    workerRef.current?.postMessage({ type: "runStressTest", id: crypto.randomUUID() });
  };

  const overheadPerSpanUs = result
    ? ((result.tracedMs - result.untracedMs) / TOTAL_INVOCATIONS) * 1000
    : null;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => startTransition(handleRun)}
        disabled={transitioning}
        className="rounded-full border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {transitioning ? "Running stress test..." : "Run tracing stress test"}
      </button>
      <div className="text-[11px] text-gray-400 text-center space-y-0.5">
        {result ? (
          <>
            <div>
              Untraced: {result.untracedMs.toFixed(1)}ms | Traced: {result.tracedMs.toFixed(1)}ms
            </div>
            <div>
              Overhead: {(result.tracedMs - result.untracedMs).toFixed(1)}ms (
              {(((result.tracedMs - result.untracedMs) / result.untracedMs) * 100).toFixed(1)}% |{" "}
              {overheadPerSpanUs!.toFixed(2)}μs/span)
            </div>
            <div className="text-gray-300">{TOTAL_INVOCATIONS.toLocaleString()} spans</div>
          </>
        ) : error ? (
          <div className="text-red-400">Error: {error}</div>
        ) : (
          <div>
            Spawns {TOTAL_INVOCATIONS.toLocaleString()} async spans (depth=
            {STRESS_DEPTH}, breadth={STRESS_BREADTH}, branches={STRESS_BRANCHES})
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main application component with tabbed interface
 * Compares custom query library implementation with TanStack Query
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("rsc");

  const [formState, setFormState] = useState(() => {
    const formData = new FormData();

    formData.set("movieLimit", "100");
    formData.set("gcTimeout", "60000");
    formData.set("searchQuery", "");
    formData.set("showDevtools", "true");
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
          <p className="text-gray-500 text-xs md:text-sm mb-6">Search thousands of movies</p>
          <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {(() => {
          switch (activeTab) {
            case "rsc":
              return (
                <LazyRSCMoviesTab
                  devtools={formState.get("showDevtools") === "true"}
                  formState={formState}
                  onFormStateChange={updateFormState}
                  api={api}
                />
              );
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
                  <p className="text-gray-500 text-sm">Cleaning up from the last tab...</p>
                </div>
              );
          }
        })()}
      </div>
      {showLagRadar && <LazyLagRadar />}
    </>
  );
}
