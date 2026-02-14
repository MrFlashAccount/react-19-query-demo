import type { TodoFilter, TodoRecord } from "./types";

interface TodoState extends TodoRecord {
  createdAt: number;
}

let todos: TodoState[] = [
  { id: "todo-1", title: "Read worker transport docs", completed: false, createdAt: 1 },
  { id: "todo-2", title: "Ship TodoMVC scenario", completed: false, createdAt: 2 },
  { id: "todo-3", title: "Verify RSC refresh cycle", completed: true, createdAt: 3 },
];

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

function getVisibleTodos(filter: TodoFilter): TodoState[] {
  switch (filter) {
    case "active":
      return todos.filter((todo) => !todo.completed);
    case "completed":
      return todos.filter((todo) => todo.completed);
    default:
      return todos;
  }
}

function getCounts() {
  const totalCount = todos.length;
  const completedCount = todos.reduce((count, todo) => count + (todo.completed ? 1 : 0), 0);
  const activeCount = totalCount - completedCount;
  return { totalCount, activeCount, completedCount };
}

export interface TodoWorkerViewData {
  filter: TodoFilter;
  visibleTodos: TodoRecord[];
  totalCount: number;
  activeCount: number;
  completedCount: number;
  allCompleted: boolean;
}

export function parseFilter(value: string | null): TodoFilter {
  if (value === "active" || value === "completed") {
    return value;
  }
  return "all";
}

export function buildTodoWorkerViewData(filter: TodoFilter): TodoWorkerViewData {
  const visibleTodos = getVisibleTodos(filter);
  const { totalCount, activeCount, completedCount } = getCounts();
  const allCompleted = totalCount > 0 && activeCount === 0;
  return {
    filter,
    visibleTodos,
    totalCount,
    activeCount,
    completedCount,
    allCompleted,
  };
}

export function readMutationResult() {
  return {
    ok: true,
    ...getCounts(),
  };
}

export function addTodoItem(title: string): void {
  const nextTitle = normalizeTitle(title);
  if (nextTitle.length === 0) {
    return;
  }
  todos = [
    {
      id: crypto.randomUUID(),
      title: nextTitle,
      completed: false,
      createdAt: Date.now(),
    },
    ...todos,
  ];
}

export function toggleTodoItem(id: string): void {
  todos = todos.map((todo) =>
    todo.id === id
      ? {
          ...todo,
          completed: !todo.completed,
        }
      : todo,
  );
}

export function renameTodoItem(id: string, title: string): void {
  const nextTitle = normalizeTitle(title);
  if (nextTitle.length === 0) {
    deleteTodoItem(id);
    return;
  }
  todos = todos.map((todo) =>
    todo.id === id
      ? {
          ...todo,
          title: nextTitle,
        }
      : todo,
  );
}

export function deleteTodoItem(id: string): void {
  todos = todos.filter((todo) => todo.id !== id);
}

export function clearCompletedTodos(): void {
  todos = todos.filter((todo) => !todo.completed);
}

export function toggleAllTodos(): void {
  const shouldComplete = todos.some((todo) => !todo.completed);
  todos = todos.map((todo) => ({
    ...todo,
    completed: shouldComplete,
  }));
}
