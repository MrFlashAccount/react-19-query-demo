import {
  createWorkerTransport,
  createWorkerTransportMessageHandler,
  type RSCTransport,
  type WorkerMessageEndpoint,
  type WorkerTransportRequestMessage,
} from "@lib/rsc-prism/transport";

/**
 * Mock worker endpoint that delivers posted messages to listeners.
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
 * Creates a worker transport backed by a mock handler. Used in tests.
 */
export function createMockWorkerTransport(
  handler: (request: WorkerTransportRequestMessage) => Promise<Response> | Response,
): RSCTransport {
  const endpoint = new MockWorkerEndpoint();
  const onMessage = createWorkerTransportMessageHandler(handler);
  endpoint.addEventListener("message", onMessage);
  return createWorkerTransport(endpoint);
}
