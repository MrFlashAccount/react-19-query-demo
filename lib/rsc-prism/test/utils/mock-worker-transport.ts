import {
  createWorkerRowTransport,
  createWorkerRowTransportMessageHandler,
  type RSCTransport,
  type WorkerMessageEndpoint,
  type WorkerTransportRequestMessage,
} from "../../src/transport";
import { flightModelRow, flightDoneRow } from "../../src/flight-runtime/wire";

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
 * Creates a worker row transport backed by a mock handler. Handler returns the value
 * for the request; it is emitted as a single model row. Used in tests without a real worker.
 */
export function createMockWorkerTransport(
  handler: (request: WorkerTransportRequestMessage) => Promise<unknown> | unknown,
): RSCTransport {
  const endpoint = new MockWorkerEndpoint();
  const onMessage = createWorkerRowTransportMessageHandler(async (request, emit) => {
    const value = await handler(request);
    emit(flightModelRow(0, value));
    emit(flightDoneRow());
  });
  endpoint.addEventListener("message", onMessage);
  return createWorkerRowTransport(endpoint);
}
