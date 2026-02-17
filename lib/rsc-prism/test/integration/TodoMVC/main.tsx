import "./styles.css";

import { Suspense, useEffect, useState, useTransition } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";

import { createWorkerTransport } from "@lib/rsc-prism/client-only";
import { TodoRuntimeProvider } from "./client-components";
import type { TodoFilter } from "./types";
import { TodoView } from "./worker-components";
import { rsc, RSCTransportProvider } from "@lib/rsc-prism/react";

const TodoViewRSC = rsc(TodoView);

function parseFilterFromLocation(): TodoFilter {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("filter");

  if (value === "active" || value === "completed") {
    return value;
  }

  return "all";
}

const runtime = (() => {
  const worker = new Worker("/todo.worker.js", { type: "module" });
  return { worker, transport: createWorkerTransport(worker) };
})();

function App() {
  const [filter, setFilterState] = useState<TodoFilter>(parseFilterFromLocation);
  const [isPending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(() => {
      setFilterState(parseFilterFromLocation());
    });
  };

  const setFilter = (nextFilter: TodoFilter) => {
    if (nextFilter === filter) {
      return;
    }

    const url = new URL(window.location.href);
    if (nextFilter === "all") {
      url.searchParams.delete("filter");
    } else {
      url.searchParams.set("filter", nextFilter);
    }

    window.history.pushState({}, "", `${url.pathname}${url.search}`);
    startTransition(() => {
      setFilterState(nextFilter);
    });
  };

  useEffect(() => {
    const handlePopState = () => {
      startTransition(() => {
        setFilterState(parseFilterFromLocation());
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => runtime.worker.terminate.bind(runtime.worker), [runtime.worker]);

  return (
    <RSCTransportProvider transport={runtime.transport}>
      <TodoRuntimeProvider
        value={{
          transport: runtime.transport,
          filter,
          setFilter,
          refresh,
        }}
      >
        <main className="app-shell">
          <header className="app-header">
            <h2>RSC TodoMVC</h2>
            <p>View rendering and data fetches run through React Server Components in a worker.</p>
          </header>

          {isPending && <p className="app-status">Refreshing RSC view...</p>}

          <ErrorBoundary
            fallbackRender={({ error }) => {
              const message = error instanceof Error ? error.message : String(error);
              return (
                <section className="todo-shell">
                  <section className="todoapp todoapp--error">
                    <h1 className="todo-title">todos</h1>
                    <p className="todo-error">Failed to load RSC payload: {message}</p>
                  </section>
                </section>
              );
            }}
          >
            <Suspense
              fallback={
                <section className="todo-shell">
                  <section className="todoapp">
                    <h1 className="todo-title">todos</h1>
                    <p className="todo-empty">Loading...</p>
                  </section>
                </section>
              }
            >
              <TodoViewRSC filter={filter} />
            </Suspense>
          </ErrorBoundary>
        </main>
      </TodoRuntimeProvider>
    </RSCTransportProvider>
  );
}

const rootElement = document.getElementById("root");
if (rootElement == null) {
  throw new Error("Missing #root element");
}

createRoot(rootElement).render(<App />);
