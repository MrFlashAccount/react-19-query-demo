import {
  createContext,
  useContext,
  useId,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import type { TodoFilter, TodoRecord } from "./types";
import { renameTodo, toggleAll } from "./todo-actions";

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

export function TodoComposer({
  totalCount,
  allCompleted,
  addTodo,
}: {
  totalCount: number;
  allCompleted: boolean;
  addTodo: (title: string) => Promise<void>;
  toggleAll: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (nextTitle.length === 0) {
      return;
    }

    startTransition(async () => {
      await addTodo(nextTitle);
      setTitle("");
    });
  };
  const handleToggleAll = () => {
    startTransition(async () => {
      await toggleAll();
    });
  };

  return (
    <header className="todo-compose">
      <button
        type="button"
        className="toggle-all"
        disabled={totalCount === 0 || isPending}
        aria-label={allCompleted ? "Mark all as active" : "Mark all as completed"}
        onClick={handleToggleAll}
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

export function TodoItemRow({
  todo,
  toggleTodo,
  deleteTodo,
}: {
  todo: TodoRecord;
  toggleTodo: (id: string) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
}) {
  const id = useId();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const [isPending, startTransition] = useTransition();

  const finishEditing = () => {
    const nextTitle = draft.trim();
    setIsEditing(false);

    if (nextTitle.length === 0) {
      startTransition(async () => {
        await deleteTodo(todo.id);
      });
      return;
    }

    if (nextTitle !== todo.title) {
      startTransition(async () => {
        await renameTodo(todo.id, nextTitle);
      });
    }
  };

  const handleToggleTodo = () => {
    startTransition(async () => {
      await toggleTodo(todo.id);
    });
  };

  const handleDeleteTodo = () => {
    startTransition(async () => {
      await deleteTodo(todo.id);
    });
  };

  return (
    <>
      <input
        id={id}
        type="checkbox"
        className="todo-toggle"
        checked={todo.completed}
        disabled={isPending}
        onChange={handleToggleTodo}
        aria-label={`Toggle ${todo.title}`}
      />
      <label htmlFor={id} className="todo-label" onDoubleClick={() => setIsEditing(true)}>
        {todo.title}
      </label>
      <button
        type="button"
        className="todo-destroy"
        disabled={isPending}
        onClick={handleDeleteTodo}
        aria-label={`Delete ${todo.title}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 4L4 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 4L12 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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
  clearCompleted,
}: {
  activeCount: number;
  completedCount: number;
  totalCount: number;
  filter: TodoFilter;
  clearCompleted: () => Promise<void>;
}) {
  const runtime = useTodoContext();
  const [isPending, startTransition] = useTransition();
  const itemLabel = activeCount === 1 ? "item" : "items";

  const handleClearCompleted = () => {
    startTransition(async () => {
      await clearCompleted();
    });
  };

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
        onClick={handleClearCompleted}
      >
        🧹
      </button>
    </footer>
  );
}
