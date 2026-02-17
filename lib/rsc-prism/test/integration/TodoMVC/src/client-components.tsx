"use main";

import {
  createContext,
  useContext,
  useId,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { callAction } from "@lib/rsc-prism/client-only";
import type { TodoFilter, TodoRecord } from "./types";
import {
  addTodo,
  clearCompleted,
  deleteTodo,
  renameTodo,
  toggleAll,
  toggleTodo,
} from "./todo-actions";

interface TodoContextValue {
  filter: TodoFilter;
  setFilter: (filter: TodoFilter) => void;
}

const TodoContext = createContext<TodoContextValue | null>(null);

export function TodoProvider({
  value,
  children,
}: {
  value: TodoContextValue;
  children: ReactNode;
}) {
  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
}

function useTodoContext(): TodoContextValue {
  const runtime = useContext(TodoContext);
  if (runtime == null) {
    throw new Error("Todo context is missing.");
  }
  return runtime;
}

function useTodoAction() {
  const [isPending, startTransition] = useTransition();

  const runAction = (
    action: ((...args: any[]) => unknown) & { $$id?: string },
    args: any[] = [],
    options?: { refresh?: boolean; onSuccess?: () => void },
  ) => {
    return new Promise((resolve, reject) => {
      startTransition(async () => {
        try {
          resolve(await callAction(action, args));
          options?.onSuccess?.();
        } catch (error) {
          const actionId = typeof action.$$id === "string" ? action.$$id : action.name || "unknown";
          console.error(`[todo-action] ${actionId} failed`, error);
          reject(error);
        }
      });
    });
  };

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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (nextTitle.length === 0) {
      return;
    }

    void runAction(addTodo, [nextTitle], {
      onSuccess: () => {
        setTitle("");
      },
    });
  };

  return (
    <header className="todo-compose">
      <button
        type="button"
        className="toggle-all"
        disabled={totalCount === 0 || isPending}
        aria-label={allCompleted ? "Mark all as active" : "Mark all as completed"}
        onClick={() => runAction(toggleAll)}
      >
        {allCompleted ? "✅" : "☑️"}
      </button>
      <form onSubmit={handleSubmit} className="todo-compose-form">
        <input
          className="new-todo"
          value={title}
          name="New todo"
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
  const id = useId();

  const finishEditing = () => {
    const nextTitle = draft.trim();
    setIsEditing(false);

    if (nextTitle.length === 0) {
      void runAction(deleteTodo, [todo.id]);
      return;
    }

    if (nextTitle !== todo.title) {
      void runAction(renameTodo, [todo.id, nextTitle]);
    }
  };

  return (
    <>
      <input
        id={id}
        type="checkbox"
        className="todo-toggle"
        checked={todo.completed}
        disabled={isPending}
        onChange={() => runAction(toggleTodo, [todo.id])}
        aria-label={`Toggle ${todo.title}`}
      />
      <label htmlFor={id} className="todo-label" onDoubleClick={() => setIsEditing(true)}>
        {todo.title}
      </label>
      <button
        type="button"
        className="todo-destroy"
        disabled={isPending}
        onClick={() => runAction(deleteTodo, [todo.id])}
        aria-label={`Delete ${todo.title}`}
      >
        ❌
      </button>

      {isEditing && (
        <input
          autoFocus
          className="todo-edit"
          value={draft}
          defaultValue={todo.title}
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
  const runtime = useTodoContext();
  const { isPending, runAction } = useTodoAction();
  const itemLabel = activeCount === 1 ? "item" : "items";

  const filters = FILTER_LABELS.map((entry) => {
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
  });

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
        🧹
      </button>
    </footer>
  );
}
