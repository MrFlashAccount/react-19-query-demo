import type { TodoFilter, TodoRecord } from "./types";

interface TodoState extends TodoRecord {
  createdAt: number;
}

let todos: TodoState[] = [
  { id: "todo-1", title: "Read worker transport docs", completed: false, createdAt: 1 },
  { id: "todo-2", title: "Ship TodoMVC scenario", completed: false, createdAt: 2 },
  { id: "todo-3", title: "Verify RSC refresh cycle", completed: true, createdAt: 3 },
  { id: "todo-4", title: "Verify RSC action cycle", completed: false, createdAt: 4 },
  { id: "todo-5", title: "Verify RSC action cycle", completed: false, createdAt: 5 },
  { id: "todo-6", title: "Verify RSC action cycle", completed: false, createdAt: 6 },
  { id: "todo-7", title: "Verify RSC action cycle", completed: false, createdAt: 7 },
  { id: "todo-8", title: "Verify RSC action cycle", completed: false, createdAt: 8 },
  { id: "todo-9", title: "Verify RSC action cycle", completed: false, createdAt: 9 },
  { id: "todo-10", title: "Verify RSC action cycle", completed: false, createdAt: 10 },
  { id: "todo-11", title: "Verify RSC action cycle", completed: false, createdAt: 11 },
  { id: "todo-12", title: "Verify RSC action cycle", completed: false, createdAt: 12 },
  { id: "todo-13", title: "Verify RSC action cycle", completed: false, createdAt: 13 },
  { id: "todo-14", title: "Verify RSC action cycle", completed: false, createdAt: 14 },
  { id: "todo-15", title: "Verify RSC action cycle", completed: false, createdAt: 15 },
  { id: "todo-16", title: "Verify RSC action cycle", completed: false, createdAt: 16 },
  { id: "todo-17", title: "Verify RSC action cycle", completed: false, createdAt: 17 },
  { id: "todo-18", title: "Verify RSC action cycle", completed: false, createdAt: 18 },
  { id: "todo-19", title: "Verify RSC action cycle", completed: false, createdAt: 19 },
  { id: "todo-20", title: "Verify RSC action cycle", completed: false, createdAt: 20 },
  { id: "todo-21", title: "Verify RSC action cycle", completed: false, createdAt: 21 },
  { id: "todo-22", title: "Verify RSC action cycle", completed: false, createdAt: 22 },
  { id: "todo-23", title: "Verify RSC action cycle", completed: false, createdAt: 23 },
  { id: "todo-24", title: "Verify RSC action cycle", completed: false, createdAt: 24 },
  { id: "todo-25", title: "Verify RSC action cycle", completed: false, createdAt: 25 },
  { id: "todo-26", title: "Verify RSC action cycle", completed: false, createdAt: 26 },
  { id: "todo-27", title: "Verify RSC action cycle", completed: false, createdAt: 27 },
  { id: "todo-28", title: "Verify RSC action cycle", completed: false, createdAt: 28 },
  { id: "todo-29", title: "Verify RSC action cycle", completed: false, createdAt: 29 },
  { id: "todo-30", title: "Verify RSC action cycle", completed: false, createdAt: 30 },
  { id: "todo-31", title: "Verify RSC action cycle", completed: false, createdAt: 31 },
  { id: "todo-32", title: "Verify RSC action cycle", completed: false, createdAt: 32 },
  { id: "todo-33", title: "Verify RSC action cycle", completed: false, createdAt: 33 },
  { id: "todo-34", title: "Verify RSC action cycle", completed: false, createdAt: 34 },
  { id: "todo-35", title: "Verify RSC action cycle", completed: false, createdAt: 35 },
  { id: "todo-36", title: "Verify RSC action cycle", completed: false, createdAt: 36 },
  { id: "todo-37", title: "Verify RSC action cycle", completed: false, createdAt: 37 },
  { id: "todo-38", title: "Verify RSC action cycle", completed: false, createdAt: 38 },
  { id: "todo-39", title: "Verify RSC action cycle", completed: false, createdAt: 39 },
  { id: "todo-40", title: "Verify RSC action cycle", completed: false, createdAt: 40 },
  { id: "todo-41", title: "Verify RSC action cycle", completed: false, createdAt: 41 },
  { id: "todo-42", title: "Verify RSC action cycle", completed: false, createdAt: 42 },
  { id: "todo-43", title: "Verify RSC action cycle", completed: false, createdAt: 43 },
  { id: "todo-44", title: "Verify RSC action cycle", completed: false, createdAt: 44 },
  { id: "todo-45", title: "Verify RSC action cycle", completed: false, createdAt: 45 },
  { id: "todo-46", title: "Verify RSC action cycle", completed: false, createdAt: 46 },
  { id: "todo-47", title: "Verify RSC action cycle", completed: false, createdAt: 47 },
  { id: "todo-48", title: "Verify RSC action cycle", completed: false, createdAt: 48 },
  { id: "todo-49", title: "Verify RSC action cycle", completed: false, createdAt: 49 },
  { id: "todo-50", title: "Verify RSC action cycle", completed: false, createdAt: 50 },
  { id: "todo-51", title: "Verify RSC action cycle", completed: false, createdAt: 51 },
  { id: "todo-52", title: "Verify RSC action cycle", completed: false, createdAt: 52 },
  { id: "todo-53", title: "Verify RSC action cycle", completed: false, createdAt: 53 },
  { id: "todo-54", title: "Verify RSC action cycle", completed: false, createdAt: 54 },
  { id: "todo-55", title: "Verify RSC action cycle", completed: false, createdAt: 55 },
  { id: "todo-56", title: "Verify RSC action cycle", completed: false, createdAt: 56 },
  { id: "todo-57", title: "Verify RSC action cycle", completed: false, createdAt: 57 },
  { id: "todo-58", title: "Verify RSC action cycle", completed: false, createdAt: 58 },
  { id: "todo-59", title: "Verify RSC action cycle", completed: false, createdAt: 59 },
  { id: "todo-60", title: "Verify RSC action cycle", completed: false, createdAt: 60 },
  { id: "todo-61", title: "Verify RSC action cycle", completed: false, createdAt: 61 },
  { id: "todo-62", title: "Verify RSC action cycle", completed: false, createdAt: 62 },
  { id: "todo-63", title: "Verify RSC action cycle", completed: false, createdAt: 63 },
  { id: "todo-64", title: "Verify RSC action cycle", completed: false, createdAt: 64 },
  { id: "todo-65", title: "Verify RSC action cycle", completed: false, createdAt: 65 },
  { id: "todo-66", title: "Verify RSC action cycle", completed: false, createdAt: 66 },
  { id: "todo-67", title: "Verify RSC action cycle", completed: false, createdAt: 67 },
  { id: "todo-68", title: "Verify RSC action cycle", completed: false, createdAt: 68 },
  { id: "todo-69", title: "Verify RSC action cycle", completed: false, createdAt: 69 },
  { id: "todo-70", title: "Verify RSC action cycle", completed: false, createdAt: 70 },
  { id: "todo-71", title: "Verify RSC action cycle", completed: false, createdAt: 71 },
  { id: "todo-72", title: "Verify RSC action cycle", completed: false, createdAt: 72 },
  { id: "todo-73", title: "Verify RSC action cycle", completed: false, createdAt: 73 },
  { id: "todo-74", title: "Verify RSC action cycle", completed: false, createdAt: 74 },
  { id: "todo-75", title: "Verify RSC action cycle", completed: false, createdAt: 75 },
  { id: "todo-76", title: "Verify RSC action cycle", completed: false, createdAt: 76 },
  { id: "todo-77", title: "Verify RSC action cycle", completed: false, createdAt: 77 },
  { id: "todo-78", title: "Verify RSC action cycle", completed: false, createdAt: 78 },
  { id: "todo-79", title: "Verify RSC action cycle", completed: false, createdAt: 79 },
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

export function addTodoItem(title: string): TodoState[] {
  const nextTitle = normalizeTitle(title);
  if (nextTitle.length === 0) {
    return todos;
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

  return todos;
}

export function toggleTodoItem(id: string): TodoState[] {
  todos = todos.map((todo) =>
    todo.id === id
      ? {
          ...todo,
          completed: !todo.completed,
        }
      : todo,
  );
  return todos;
}

export function renameTodoItem(id: string, title: string): TodoState[] {
  const nextTitle = normalizeTitle(title);
  if (nextTitle.length === 0) {
    deleteTodoItem(id);
    return todos;
  }
  todos = todos.map((todo) =>
    todo.id === id
      ? {
          ...todo,
          title: nextTitle,
        }
      : todo,
  );
  return todos;
}

export function deleteTodoItem(id: string): TodoState[] {
  todos = todos.filter((todo) => todo.id !== id);
  return todos;
}

export function clearCompletedTodos(): TodoState[] {
  todos = todos.filter((todo) => !todo.completed);
  return todos;
}

export function toggleAllTodos(): TodoState[] {
  const shouldComplete = todos.some((todo) => !todo.completed);
  todos = todos.map((todo) => ({
    ...todo,
    completed: shouldComplete,
  }));
  return todos;
}
