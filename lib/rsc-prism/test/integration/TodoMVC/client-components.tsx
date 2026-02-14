"use main";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { callAction, type RSCTransport } from "@lib/rsc-prism/client-only";
import type { TodoFilter, TodoRecord } from "./types";
import {
  addTodo,
  clearCompleted,
  deleteTodo,
  renameTodo,
  toggleAll,
  toggleTodo,
} from "./todo-actions";

interface TodoRuntime {
  transport: RSCTransport;
  filter: TodoFilter;
  setFilter: (filter: TodoFilter) => void;
  refresh: () => void;
}

const TodoRuntimeContext = createContext<TodoRuntime | null>(null);

export function TodoRuntimeProvider({
  value,
  children,
}: {
  value: TodoRuntime;
  children: ReactNode;
}) {
  return <TodoRuntimeContext.Provider value={value}>{children}</TodoRuntimeContext.Provider>;
}

function useTodoRuntime(): TodoRuntime {
  const runtime = useContext(TodoRuntimeContext);
  if (runtime == null) {
    throw new Error("Todo runtime context is missing.");
  }
  return runtime;
}

function useTodoAction() {
  const runtime = useTodoRuntime();
  const [isPending, startTransition] = useTransition();

  const runAction = useCallback(
    (
      action: ((...args: any[]) => unknown) & { $$id?: string },
      args: any[] = [],
      options?: { refresh?: boolean; onSuccess?: () => void },
    ) => {
      startTransition(() => {
        void (async () => {
          try {
            await callAction(action, args, {
              transport: runtime.transport,
            });
            options?.onSuccess?.();
            if (options?.refresh ?? true) {
              runtime.refresh();
            }
          } catch (error) {
            const actionId =
              typeof action.$$id === "string" ? action.$$id : action.name || "unknown";
            console.error(`[todo-action] ${actionId} failed`, error);
          }
        })();
      });
    },
    [runtime],
  );

  return { isPending, runAction };
}

export function TodoComposer({
  totalCount,
  allCompleted,
}: {
  totalCount: number;
  allCompleted: boolean;
}) {
  const [title, setTitle] = useState("");
  const { isPending, runAction } = useTodoAction();

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const nextTitle = title.trim();
      if (nextTitle.length === 0) {
        return;
      }

      runAction(addTodo, [nextTitle], {
        onSuccess: () => {
          setTitle("");
        },
      });
    },
    [runAction, title],
  );

  return (
    <header className="todo-compose">
      <button
        type="button"
        className="toggle-all"
        disabled={totalCount === 0 || isPending}
        aria-label={allCompleted ? "Mark all as active" : "Mark all as completed"}
        onClick={() => runAction(toggleAll)}
      >
        {allCompleted ? "v" : ">"}
      </button>
      <form onSubmit={handleSubmit} className="todo-compose-form">
        <input
          className="new-todo"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs to be done?"
          aria-label="New todo"
          autoComplete="off"
        />
      </form>
    </header>
  );
}

export function TodoItemRow({ todo }: { todo: TodoRecord }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const { isPending, runAction } = useTodoAction();

  const finishEditing = useCallback(() => {
    const nextTitle = draft.trim();
    setIsEditing(false);

    if (nextTitle.length === 0) {
      runAction(deleteTodo, [todo.id]);
      return;
    }

    if (nextTitle !== todo.title) {
      runAction(renameTodo, [todo.id, nextTitle]);
    }
  }, [draft, runAction, todo.id, todo.title]);

  return (
    <>
      <input
        type="checkbox"
        className="todo-toggle"
        checked={todo.completed}
        disabled={isPending}
        onChange={() => runAction(toggleTodo, [todo.id])}
        aria-label={`Toggle ${todo.title}`}
      />
      <label className="todo-label" onDoubleClick={() => setIsEditing(true)}>
        {todo.title}
      </label>
      <button
        type="button"
        className="todo-destroy"
        disabled={isPending}
        onClick={() => runAction(deleteTodo, [todo.id])}
        aria-label={`Delete ${todo.title}`}
      >
        x
      </button>

      {isEditing && (
        <input
          autoFocus
          className="todo-edit"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={finishEditing}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              finishEditing();
            }
            if (event.key === "Escape") {
              setDraft(todo.title);
              setIsEditing(false);
            }
          }}
        />
      )}
    </>
  );
}

const FILTER_LABELS: Array<{ filter: TodoFilter; label: string }> = [
  { filter: "all", label: "All" },
  { filter: "active", label: "Active" },
  { filter: "completed", label: "Completed" },
];

export function TodoFooterControls({
  activeCount,
  completedCount,
  totalCount,
  filter,
}: {
  activeCount: number;
  completedCount: number;
  totalCount: number;
  filter: TodoFilter;
}) {
  const runtime = useTodoRuntime();
  const { isPending, runAction } = useTodoAction();
  const itemLabel = activeCount === 1 ? "item" : "items";

  const filters = useMemo(
    () =>
      FILTER_LABELS.map((entry) => {
        const isSelected = entry.filter === filter;
        return (
          <li key={entry.filter}>
            <a
              href={entry.filter === "all" ? "?" : `?filter=${entry.filter}`}
              className={isSelected ? "selected" : undefined}
              onClick={(event) => {
                event.preventDefault();
                runtime.setFilter(entry.filter);
              }}
            >
              {entry.label}
            </a>
          </li>
        );
      }),
    [filter, runtime],
  );

  return (
    <footer className="todo-footer">
      <span className="todo-count">
        <strong>{activeCount}</strong> {itemLabel} left
      </span>

      <ul className="filters">{filters}</ul>

      <button
        type="button"
        className="clear-completed"
        disabled={completedCount === 0 || totalCount === 0 || isPending}
        onClick={() => runAction(clearCompleted)}
      >
        Clear completed
      </button>
    </footer>
  );
}
