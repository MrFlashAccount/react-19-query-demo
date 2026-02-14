/// <reference lib="webworker" />

import "@lib/rsc-prism/runtime/webpack-shim";

import { createWorkerTransportMessageHandler, type WorkerTransportRequestMessage } from "@lib/rsc-prism/transport";
import { createRSCHandler } from "@lib/rsc-prism/response";

import { addTodo, clearCompleted, deleteTodo, renameTodo, toggleAll, toggleTodo } from "./todo-actions";
import { buildTodoWorkerViewData, parseFilter } from "./todo-model";
import { TodoWorkerView } from "./worker-components";

const WORKER_ORIGIN = "https://rsc.todo.local";
const WORKER_COMPONENT_MODULE_ID = "worker-components.tsx";
const ACTION_MODULE_ID = "todo-actions.ts";

function resolveWorkerComponent(
  componentId: string | undefined,
): ((props: Parameters<typeof TodoWorkerView>[0]) => ReturnType<typeof TodoWorkerView>) | null {
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
    [`${ACTION_MODULE_ID}#addTodo`]: addTodo as (...args: unknown[]) => unknown,
    [`${ACTION_MODULE_ID}#toggleTodo`]: toggleTodo as (...args: unknown[]) => unknown,
    [`${ACTION_MODULE_ID}#renameTodo`]: renameTodo as (...args: unknown[]) => unknown,
    [`${ACTION_MODULE_ID}#deleteTodo`]: deleteTodo as (...args: unknown[]) => unknown,
    [`${ACTION_MODULE_ID}#clearCompleted`]: clearCompleted as (...args: unknown[]) => unknown,
    [`${ACTION_MODULE_ID}#toggleAll`]: toggleAll as (...args: unknown[]) => unknown,
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
        return handler.render(<TodoWorkerView {...buildTodoWorkerViewData(filter)} />);
      }

      const filter = parseFilter(endpoint.searchParams.get("filter"));
      return handler.render(<TodoWorkerView {...buildTodoWorkerViewData(filter)} />);
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
