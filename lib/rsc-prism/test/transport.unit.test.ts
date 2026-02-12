import { describe, expect, it, vi } from "vitest";

import {
  createFunctionTransport,
  createWorkerTransport,
  createWorkerTransportMessageHandler,
  type WorkerMessageEndpoint,
  type WorkerTransportRequestMessage,
} from "../src/transport";

class MockWorkerEndpoint implements WorkerMessageEndpoint {
  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();
  onPostMessage?: (message: unknown) => void;

  postMessage(message: unknown): void {
    this.onPostMessage?.(message);
  }

  addEventListener(_type: "message", listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.delete(listener);
  }

  emitMessage(data: unknown): void {
    const event = {
      data,
      currentTarget: this,
    } as unknown as MessageEvent<unknown>;

    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

describe("transport", () => {
  it("function transport maps action and fetch requests", async () => {
    const handler = vi.fn(async (request) => {
      if (request.method === "POST") {
        expect(request.url).toBe("/rsc");
        expect(request.headers.get("x-rsc-action")).toBe("run");
        expect(request.headers.get("content-type")).toBe("text/plain");
        expect(request.body).toBe("[1]");
        return new Response("action-ok", { status: 201 });
      }

      expect(request.method).toBe("GET");
      expect(request.headers.get("accept")).toBe("text/x-component");
      return new Response("fetch-ok", { status: 200 });
    });

    const transport = createFunctionTransport(handler);
    const actionResponse = await transport.sendAction({
      endpoint: "/rsc",
      actionId: "run",
      body: "[1]",
      contentType: "text/plain",
    });
    const fetchResponse = await transport.fetchRSC?.({ url: "/rsc" });

    expect(actionResponse.status).toBe(201);
    await expect(actionResponse.text()).resolves.toBe("action-ok");
    expect(fetchResponse?.status).toBe(200);
    await expect(fetchResponse?.text()).resolves.toBe("fetch-ok");
  });

  it("worker transport sends request and resolves response", async () => {
    const endpoint = new MockWorkerEndpoint();
    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      expect(request.type).toBe("rsc.transport.request");
      expect(request.operation).toBe("action");
      expect(request.actionId).toBe("do");
      endpoint.emitMessage({
        type: "rsc.transport.response",
        id: request.id,
        status: 200,
        headers: [["content-type", "text/plain"]],
        body: "worker-ok",
      });
    };

    const transport = createWorkerTransport(endpoint);
    const response = await transport.sendAction({
      endpoint: "/rsc",
      actionId: "do",
      body: "x=1",
      contentType: "application/x-www-form-urlencoded",
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("worker-ok");
  });

  it("worker transport times out when no response is received", async () => {
    const endpoint = new MockWorkerEndpoint();
    const transport = createWorkerTransport(endpoint, { timeoutMs: 5 });

    await expect(
      transport.sendAction({
        endpoint: "/rsc",
        actionId: "do",
        body: "[]",
        contentType: "text/plain",
      }),
    ).rejects.toThrow("Worker transport timed out");
  });

  it("worker message handler converts request to response payload", async () => {
    const postMessage = vi.fn();
    const onMessage = createWorkerTransportMessageHandler(async (request) => {
      expect(request.operation).toBe("fetch");
      expect(request.endpoint).toBe("/rsc");
      return new Response("handler-ok", {
        status: 207,
        headers: { "x-test": "1" },
      });
    });

    await onMessage({
      data: {
        type: "rsc.transport.request",
        id: "abc",
        operation: "fetch",
        endpoint: "/rsc",
      },
      currentTarget: { postMessage },
    } as unknown as MessageEvent<unknown>);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "rsc.transport.response",
        id: "abc",
        status: 207,
        body: "handler-ok",
      }),
    );
  });
});
