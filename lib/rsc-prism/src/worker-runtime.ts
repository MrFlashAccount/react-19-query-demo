import { createRSCHandler } from "./response";
import {
  createWorkerRowTransportMessageHandler,
  type WorkerTransportRequestMessage,
} from "./transport";
import type { ReactNode } from "react";
import { flightErrorRow } from "./flight-runtime/wire";

interface WorkerRuntimeModuleConfig {
  moduleId: string;
  moduleExports: Record<string, unknown>;
}

export interface CreateWorkerRuntimeOptions {
  endpoint?: string;
  actionEndpoint?: string;
  workerOrigin?: string;
  componentModules: WorkerRuntimeModuleConfig[];
  actionModules?: WorkerRuntimeModuleConfig[];
}

function buildComponentRegistry(
  modules: WorkerRuntimeModuleConfig[],
): Map<string, (props: unknown) => unknown> {
  const registry = new Map<string, (props: unknown) => unknown>();
  for (const moduleConfig of modules) {
    for (const [exportName, value] of Object.entries(moduleConfig.moduleExports)) {
      if (typeof value !== "function") {
        continue;
      }
      registry.set(`${moduleConfig.moduleId}#${exportName}`, value as (props: unknown) => unknown);
    }
  }
  return registry;
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

export function createWorkerRuntime(options: CreateWorkerRuntimeOptions): void {
  const endpoint = options.endpoint ?? "/rsc/view";
  const actionEndpoint = options.actionEndpoint ?? "/rsc/action";
  const workerOrigin = options.workerOrigin ?? "https://rsc.prism.local";
  const componentRegistry = buildComponentRegistry(options.componentModules);
  const handler = createRSCHandler({
    actionModules: options.actionModules ?? [],
  });

  self.addEventListener(
    "message",
    createWorkerRowTransportMessageHandler(async (request: WorkerTransportRequestMessage, emit) => {
      const target = new URL(request.endpoint, workerOrigin);

      if (request.operation === "fetch") {
        if (target.pathname !== endpoint) {
          emit(flightErrorRow(`Unknown endpoint: ${target.pathname}`));
          return;
        }

        const component = componentRegistry.get(request.componentId ?? "");
        if (component == null) {
          emit(flightErrorRow("Missing or unknown worker component reference."));
          return;
        }

        await handler.renderRows(component(request.componentProps ?? {}) as ReactNode, emit);
        return;
      }

      if (request.operation === "action") {
        if (target.pathname !== actionEndpoint) {
          emit(flightErrorRow(`Unknown endpoint: ${target.pathname}`));
          return;
        }

        await handler.actionRows(toActionRequest(request, target), emit, {
          status: 200,
        });
        return;
      }

      emit(flightErrorRow("Unsupported operation"));
    }),
  );

  self.postMessage({ type: "rsc.prism.worker.ready" });
}
