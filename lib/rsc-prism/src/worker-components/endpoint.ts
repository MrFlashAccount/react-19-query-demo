/**
 * Worker endpoint state management for pending requests.
 */

import type { WorkerMessageEndpoint } from "./types";

interface PendingWorkerRequest {
  touchActivity: () => void;
  handleMessage: (message: unknown) => void;
}

interface WorkerEndpointState {
  pending: Map<string, PendingWorkerRequest>;
}

const workerEndpointState = new WeakMap<WorkerMessageEndpoint, WorkerEndpointState>();

export function getWorkerEndpointState(endpoint: WorkerMessageEndpoint): WorkerEndpointState {
  const existing = workerEndpointState.get(endpoint);
  if (existing) {
    return existing;
  }

  const state: WorkerEndpointState = {
    pending: new Map(),
  };

  endpoint.addEventListener("message", (event) => {
    const message = event.data as Record<string, unknown> | null;
    if (message == null || typeof message.id !== "string" || typeof message.type !== "string") {
      return;
    }

    const pending = state.pending.get(message.id);
    if (!pending) {
      return;
    }

    pending.touchActivity();
    pending.handleMessage(message);
  });

  workerEndpointState.set(endpoint, state);
  return state;
}
