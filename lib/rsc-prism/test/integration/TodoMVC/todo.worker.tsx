/// <reference lib="webworker" />

import "@lib/rsc-prism/runtime/webpack-shim";

import { createWorkerTransportMessageHandler, type WorkerTransportRequestMessage } from "@lib/rsc-prism/transport";
import { createRSCHandler } from "@lib/rsc-prism/response";

import type { TodoFilter, TodoRecord } from "./types";
import { TodoWorkerView } from "./worker-components";
import type { TodoWorkerViewProps } from "./worker-components";

interface TodoState extends TodoRecord {
  createdAt: number;
}

const WORKER_ORIGIN = "https://rsc.todo.local";
const WORKER_COMPONENT_MODULE_ID = "worker-components.tsx";

let todos: TodoState[] = [
  { id: "todo-1", title: "Read worker transport docs", completed: false, createdAt: 1 },
  { id: "todo-2", title: "Ship TodoMVC scenario", completed: false, createdAt: 2 },
  { id: "todo-3", title: "Verify RSC refresh cycle", completed: true, createdAt: 3 },
];

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

function parseFilter(value: string | null): TodoFilter {
  if (value === "active" || value === "completed") {
    return value;
  }
  return "all";
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

function mutationResult() {
  return {
    ok: true,
    ...getCounts(),
  };
}

function buildTodoWorkerViewProps(filter: TodoFilter): TodoWorkerViewProps {
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

function resolveWorkerComponent(
  componentId: string | undefined,
): ((props: TodoWorkerViewProps) => ReturnType<typeof TodoWorkerView>) | null {
  if (componentId == null) {
    return null;
  }

  const [moduleId, exportName = "default"] = componentId.split("#");
  if (moduleId !== WORKER_COMPONENT_MODULE_ID || exportName !== "TodoWorkerView") {
    return null;
  }

  return TodoWorkerView;
}

const handler = createRSCHandler({
  actions: {
    addTodo(...args: unknown[]) {
      const [title] = args as [string];
      const nextTitle = normalizeTitle(title);
      if (nextTitle.length === 0) {
        return mutationResult();
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

      return mutationResult();
    },

    toggleTodo(...args: unknown[]) {
      const [id] = args as [string];
      todos = todos.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              completed: !todo.completed,
            }
          : todo,
      );
      return mutationResult();
    },

    renameTodo(...args: unknown[]) {
      const [id, title] = args as [string, string];
      const nextTitle = normalizeTitle(title);
      if (nextTitle.length === 0) {
        todos = todos.filter((todo) => todo.id !== id);
        return mutationResult();
      }

      todos = todos.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              title: nextTitle,
            }
          : todo,
      );
      return mutationResult();
    },

    deleteTodo(...args: unknown[]) {
      const [id] = args as [string];
      todos = todos.filter((todo) => todo.id !== id);
      return mutationResult();
    },

    clearCompleted() {
      todos = todos.filter((todo) => !todo.completed);
      return mutationResult();
    },

    toggleAll() {
      const shouldComplete = todos.some((todo) => !todo.completed);
      todos = todos.map((todo) => ({
        ...todo,
        completed: shouldComplete,
      }));
      return mutationResult();
    },
  },
});

function notFound(pathname: string): Response {
  return new Response(JSON.stringify({ error: `Unknown endpoint: ${pathname}` }), {
    status: 404,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function toActionRequest(message: WorkerTransportRequestMessage, endpoint: URL): Request {
  const headers = new Headers(message.headers ?? []);
  if (message.actionId != null) {
    headers.set("x-rsc-action", message.actionId);
  }
  if (message.contentType != null) {
    headers.set("content-type", message.contentType);
  }

  return new Request(endpoint.toString(), {
    ...message.requestInit,
    method: "POST",
    headers,
    body: message.body ?? "",
  });
}

self.addEventListener(
  "message",
  createWorkerTransportMessageHandler(async (request: WorkerTransportRequestMessage) => {
    const endpoint = new URL(request.endpoint, WORKER_ORIGIN);

    if (request.operation === "fetch") {
      if (endpoint.pathname !== "/rsc/view") {
        return notFound(endpoint.pathname);
      }

      const workerComponent = resolveWorkerComponent(request.componentId);
      if (workerComponent != null) {
        const rawFilter =
          typeof request.componentProps === "object" && request.componentProps != null
            ? (request.componentProps as { filter?: unknown }).filter
            : null;
        const filter = parseFilter(typeof rawFilter === "string" ? rawFilter : null);
        return handler.render(<TodoWorkerView {...buildTodoWorkerViewProps(filter)} />);
      }

      const filter = parseFilter(endpoint.searchParams.get("filter"));
      return handler.render(<TodoWorkerView {...buildTodoWorkerViewProps(filter)} />);
    }

    if (request.operation === "action") {
      if (endpoint.pathname !== "/rsc/action") {
        return notFound(endpoint.pathname);
      }

      const actionRequest = toActionRequest(request, endpoint);
      return handler.action(actionRequest, {
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported operation" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }),
);
