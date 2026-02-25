import {
  createWorkerTransport,
  createWorkerRowTransport,
  createWorkerRowTransportMessageHandler,
  createWorkerTransportMessageHandler,
  type RSCTransport,
  type WorkerMessageEndpoint,
  type WorkerTransportRequestMessage,
} from "../../src/transport";
import { ROW_DONE, ROW_MODEL, flightErrorRow } from "../../src/flight-runtime/wire";

/**
 * Mock worker endpoint that delivers posted messages to listeners (so worker handler
 * receives requests when transport posts, and transport receives responses when handler posts).
 */
class MockWorkerEndpoint implements WorkerMessageEndpoint {
  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();

  postMessage(message: unknown): void {
    const event = {
      data: message,
      currentTarget: this,
    } as unknown as MessageEvent<unknown>;
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  addEventListener(_type: "message", listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.delete(listener);
  }
}

/**
 * Creates a worker transport backed by a mock handler. Used in tests that need
 * a transport without a real worker.
 *
 * @deprecated Use createMockWorkerRowTransport for worker row transport (supported path).
 * This creates the legacy stream transport which no longer supports consumeStream.
 */
export function createMockWorkerTransport(
  handler: (request: WorkerTransportRequestMessage) => Promise<Response> | Response,
): RSCTransport {
  const endpoint = new MockWorkerEndpoint();
  const onMessage = createWorkerTransportMessageHandler(handler);
  endpoint.addEventListener("message", onMessage);
  return createWorkerTransport(endpoint);
}

/**
 * Creates a worker row transport backed by a mock handler. Emits row protocol
 * messages instead of stream Response. Use for fetch/call tests.
 */
export function createMockWorkerRowTransport(
  handler: (
    request: WorkerTransportRequestMessage,
  ) => Promise<unknown> | unknown | { __rscPrismError: true; message: string; status?: number },
): RSCTransport {
  const endpoint = new MockWorkerEndpoint();
  const onMessage = createWorkerRowTransportMessageHandler(async (request, emit) => {
    const value = await handler(request);
    if (
      typeof value === "object" &&
      value != null &&
      (value as { __rscPrismError?: boolean }).__rscPrismError === true
    ) {
      const err = value as { message: string };
      emit(flightErrorRow(err.message));
      return;
    }
    emit({ k: ROW_MODEL, id: 0, v: value });
    emit({ k: ROW_DONE });
  });
  endpoint.addEventListener("message", onMessage);
  return createWorkerRowTransport(endpoint);
}
