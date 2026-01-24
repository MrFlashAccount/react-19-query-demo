import type { MovieApi } from "./api/types";
import type { TabId } from "./components/shared/TabSelector";
import { traced } from "@lib/tracing";
import type { ISpan } from "@lib/tracing";
import { useState, lazy, useTransition } from "react";

import {
  searchMovies,
  getMovieById,
  updateMovieRating,
  searchMoviesRSC,
  updateMovieRatingRSC,
} from "./api/movieApi";
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

// Total invocations: branches * (breadth^(depth+1) - 1) / (breadth - 1) + 2 (root + tail) * STRESS_TASKS
const TOTAL_INVOCATIONS =
  (STRESS_BRANCHES * ((STRESS_BREADTH ** (STRESS_DEPTH + 1) - 1) / (STRESS_BREADTH - 1)) + 2) *
  STRESS_TASKS;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Non-traced version for baseline comparison
const runBranchUntraced = async (depth: number, breadth: number): Promise<void> => {
  await sleep(2 + Math.random() * 10);

  if (depth <= 0) {
    return;
  }

  const tasks = Array.from({ length: breadth }, () => runBranchUntraced(depth - 1, breadth));
  await Promise.all(tasks);
  await sleep(2 + Math.random() * 10);
};

const runStressTestUntraced = async (): Promise<void> => {
  await sleep(5 + Math.random() * 15);

  for (let i = 0; i < STRESS_TASKS; i += 1) {
    const branches = Array.from({ length: STRESS_BRANCHES }, () =>
      runBranchUntraced(STRESS_DEPTH, STRESS_BREADTH),
    );
    await Promise.all(branches);
    await sleep(5 + Math.random() * 15);
  }

  // tail
  for (let i = 0; i < 5; i += 1) {
    await sleep(4 + i + Math.random() * 6);
  }
};

// Traced version
const runBranch = async (
  parent: ISpan,
  depth: number,
  breadth: number,
  path: string,
): Promise<void> => {
  const withSpan = traced(
    async (span: ISpan) => {
      await sleep(2 + Math.random() * 10);

      if (depth <= 0) {
        return;
      }

      const tasks = Array.from({ length: breadth }, (_, index) =>
        runBranch(span, depth - 1, breadth, `${path}.${index}`),
      );
      await Promise.all(tasks);
      await sleep(2 + Math.random() * 10);
    },
    {
      name: `stress:node:${path}`,
      payload: { depth, breadth, path, parent: parent.payload },
      meta: { color: depth % 2 === 0 ? "secondary" : "tertiary" },
      parentSpan: parent,
    },
  );

  await withSpan();
};

const runTracingStressTest = async (): Promise<void> => {
  const rootSpan = traced(
    async (root) => {
      await sleep(5 + Math.random() * 15);

      for (let i = 0; i < STRESS_TASKS; i += 1) {
        const branches = Array.from({ length: STRESS_BRANCHES }, (_, index) =>
          runBranch(root, STRESS_DEPTH, STRESS_BREADTH, `root-${index}`),
        );
        await Promise.all(branches);
        await sleep(5 + Math.random() * 15);
      }

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
        },
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
    },
  );

  await rootSpan();
};

interface StressTestResult {
  untracedMs: number;
  tracedMs: number;
}

function TracingStressTest() {
  const [transitioning, startTransition] = useTransition();
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setError(null);
    setResult(null);

    try {
      // Run untraced first
      const untracedStart = performance.now();
      await runStressTestUntraced();
      const untracedMs = performance.now() - untracedStart;

      // Run traced
      const tracedStart = performance.now();
      await runTracingStressTest();
      const tracedMs = performance.now() - tracedStart;

      setResult({ untracedMs, tracedMs });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
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
    searchMoviesRSC,
    updateMovieRatingRSC,
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
          <div className="mt-6 flex justify-center">
            <TracingStressTest />
          </div>
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
