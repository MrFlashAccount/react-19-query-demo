import "./styles.css";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";

import { createWorkerTransport, fetchRSC, type RSCTransport } from "@lib/rsc-prism/client-only";
import { TodoRuntimeProvider } from "./client-components";
import type { TodoFilter } from "./types";
import { TodoWorkerView } from "./worker-components";

function parseFilterFromLocation(): TodoFilter {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("filter");
  if (value === "active" || value === "completed") {
    return value;
  }
  return "all";
}

function loadTodoView(filter: TodoFilter, transport: RSCTransport): Promise<ReactNode> {
  return fetchRSC(TodoWorkerView, { transport, props: { filter } }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return (
      <section className="todo-shell">
        <section className="todoapp todoapp--error">
          <h1 className="todo-title">todos</h1>
          <p className="todo-error">Failed to load RSC payload: {message}</p>
        </section>
      </section>
    );
  });
}

function RSCView({ promise }: { promise: Promise<ReactNode> }) {
  return promise;
}

function App() {
  const [runtime] = useState(() => {
    const worker = new Worker("/todo.worker.js");
    return {
      worker,
      transport: createWorkerTransport(worker),
    };
  });

  const [filter, setFilterState] = useState<TodoFilter>(() => parseFilterFromLocation());
  const [viewPromise, setViewPromise] = useState(() => loadTodoView(filter, runtime.transport));
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    const nextFilter = parseFilterFromLocation();
    setFilterState(nextFilter);
    startTransition(() => {
      setViewPromise(loadTodoView(nextFilter, runtime.transport));
    });
  }, [runtime.transport]);

  const setFilter = useCallback(
    (nextFilter: TodoFilter) => {
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
      setFilterState(nextFilter);
      startTransition(() => {
        setViewPromise(loadTodoView(nextFilter, runtime.transport));
      });
    },
    [filter, runtime.transport],
  );

  useEffect(() => {
    const handlePopState = () => {
      const nextFilter = parseFilterFromLocation();
      setFilterState(nextFilter);
      startTransition(() => {
        setViewPromise(loadTodoView(nextFilter, runtime.transport));
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [runtime.transport]);

  useEffect(() => {
    return () => {
      runtime.worker.terminate();
    };
  }, [runtime.worker]);

  const contextValue = useMemo(
    () => ({
      transport: runtime.transport,
      filter,
      setFilter,
      refresh,
    }),
    [filter, refresh, runtime.transport, setFilter],
  );

  return (
    <TodoRuntimeProvider value={contextValue}>
      <main className="app-shell">
        <header className="app-header">
          <h2>RSC TodoMVC</h2>
          <p>View rendering and data fetches run through React Server Components in a worker.</p>
        </header>

        {isPending && <p className="app-status">Refreshing RSC view...</p>}

        <Suspense
          fallback={
            <section className="todo-shell">
              <section className="todoapp">
                <h1 className="todo-title">todos</h1>
                <p className="todo-empty">Loading from worker...</p>
              </section>
            </section>
          }
        >
          <RSCView promise={viewPromise} />
        </Suspense>
      </main>
    </TodoRuntimeProvider>
  );
}

const rootElement = document.getElementById("root");
if (rootElement == null) {
  throw new Error("Missing #root element");
}

createRoot(rootElement).render(<App />);
