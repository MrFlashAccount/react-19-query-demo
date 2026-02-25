import "./styles.css";
import { StrictMode, Suspense, useEffect, useState, useTransition } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { TodoComposer, TodoItemRow as TodoItemRowClient, TodoFooterControls } from "./components";
import { buildTodoWorkerViewData } from "./todo-model";
import type { TodoFilter, TodoRecord } from "./types";

import { TodoProvider } from "./components";
import { rsc, RuntimeProvider } from "@lib/rsc-prism/react";
import { createRoot } from "react-dom/client";
import { toggleTodo, deleteTodo, addTodo, toggleAll, clearCompleted } from "./todo-actions";

function parseFilterFromLocation(): TodoFilter {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("filter");

  if (value === "active" || value === "completed") {
    return value;
  }

  return "all";
}

function App() {
  const [filter, setFilterState] = useState<TodoFilter>(parseFilterFromLocation);
  const [isPending, startTransition] = useTransition();

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

  return (
    <TodoProvider value={{ filter, setFilter }}>
      <main className="app-shell">
        <header className="app-header">
          <h2>RSC TodoMVC</h2>
          <p>View rendering and data fetches run through React Server Components in a worker.</p>
        </header>

        <p className="app-status" aria-live="polite">
          {isPending ? "Refreshing RSC view..." : ""}
        </p>

        <TodoMetricsRSC filter={filter} />
        <TodoViewRSC filter={filter} />
      </main>
    </TodoProvider>
  );
}

export interface TodoViewProps {
  filter: TodoFilter;
}

const TodoViewRSC = rsc(async function TodoViewRSC({ filter }: TodoViewProps) {
  "use worker";

  const { visibleTodos, totalCount, activeCount, completedCount, allCompleted } =
    await buildTodoWorkerViewData(filter);

  return (
    <section className="todo-shell">
      <section className="todoapp">
        <h1 className="todo-title">todos</h1>

        <TodoComposer
          totalCount={totalCount}
          allCompleted={allCompleted}
          addTodo={addTodo}
          toggleAll={toggleAll}
        />

        <section className="todo-main">
          {visibleTodos.length === 0 ? (
            <p className="todo-empty">No todos for this filter.</p>
          ) : (
            <ul className="todo-list">
              {visibleTodos.map((todo) => (
                <TodoItemRow key={todo.id} todo={todo} />
              ))}
            </ul>
          )}
        </section>

        <TodoFooterControls
          totalCount={totalCount}
          activeCount={activeCount}
          completedCount={completedCount}
          filter={filter}
          clearCompleted={clearCompleted}
        />
      </section>
    </section>
  );
});

const TodoMetricsRSC = rsc(async function TodoMetricsRSC({ filter }: TodoViewProps) {
  "use worker";

  const { totalCount, activeCount, completedCount } = await buildTodoWorkerViewData(filter);

  return (
    <section className="todo-metrics" aria-live="polite">
      <p>
        Total: <strong data-testid="todo-total-count">{totalCount}</strong>
      </p>
      <p>
        Active: <strong data-testid="todo-active-count">{activeCount}</strong>
      </p>
      <p>
        Completed: <strong data-testid="todo-completed-count">{completedCount}</strong>
      </p>
    </section>
  );
});

function TodoItemRow({ todo }: { todo: TodoRecord }) {
  return (
    <li className={`todo-row ${todo.completed ? "todo-row--completed" : ""}`}>
      <div className="todo-view">
        <TodoItemRowClient todo={todo} toggleTodo={toggleTodo} deleteTodo={deleteTodo} />
      </div>
    </li>
  );
}

const rootElement = document.getElementById("root");
if (rootElement == null) {
  throw new Error("Missing #root element");
}

createRoot(rootElement).render(
  <StrictMode>
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
            <div className="todoapp">
              <h1 className="todo-title">todos</h1>
              <p className="todo-empty">Loading...</p>
            </div>
          </section>
        }
      >
        <RuntimeProvider>
          <App />
        </RuntimeProvider>
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
);
