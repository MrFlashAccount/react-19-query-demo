import { beforeEach, describe, expect, it, vi } from "vitest";
import { setInvalidateRSC, setRSCRefreshRuntime } from "../src/runtime-globals";

import {
  createFunctionTransport,
  createWorkerRowTransport,
  createWorkerRowTransportMessageHandler,
  createWorkerTransport,
  createWorkerTransportMessageHandler,
  type WorkerMessageEndpoint,
  type WorkerRowResponseMessage,
  type WorkerTransportRequestMessage,
} from "../src/transport";
import {
  flightBinaryRow,
  flightDoneRow,
  flightModelRow,
  ROW_ERROR,
} from "../src/flight-runtime/wire";

class MockWorkerEndpoint implements WorkerMessageEndpoint {
  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();
  onPostMessage?: (message: unknown) => void;
  addCalls = 0;
  removeCalls = 0;

  postMessage(message: unknown): void {
    this.onPostMessage?.(message);
  }

  addEventListener(_type: "message", listener: (event: MessageEvent<unknown>) => void): void {
    this.addCalls += 1;
    this.listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: (event: MessageEvent<unknown>) => void): void {
    this.removeCalls += 1;
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

  listenerCount(): number {
    return this.listeners.size;
  }
}

const CANONICAL_WORKER_REQUEST_KEYS = [
  "type",
  "id",
  "operation",
  "endpoint",
  "actionId",
  "contentType",
  "headers",
  "body",
  "requestInit",
  "componentId",
  "componentProps",
  "refreshTargets",
  "refreshBatchSeq",
];

describe("transport", () => {
  beforeEach(() => {
    setInvalidateRSC(() => {});
    setRSCRefreshRuntime({
      collectTargets: () => [],
      applyBatch: () => {},
      legacyInvalidate: () => {},
    });
  });

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

  it("function transport propagates action invalidate cause metadata", async () => {
    const invalidateSpy = vi.fn();
    setInvalidateRSC(invalidateSpy);
    const transport = createFunctionTransport(async () => new Response("ok", { status: 200 }));

    await transport.sendAction({
      endpoint: "/rsc",
      actionId: "run",
      body: "[]",
      contentType: "text/plain",
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy.mock.calls[0]?.[0]).toMatchObject({
      causeType: "action-legacy-invalidate",
      actionId: "run",
      requestId: expect.any(String),
      generation: expect.any(Number),
      dispatchedAt: expect.any(Number),
    });
  });

  it("worker transport resolves head and streams chunks", async () => {
    const endpoint = new MockWorkerEndpoint();
    const chunkA = Uint8Array.from([1, 2, 3]);
    const chunkB = Uint8Array.from([4, 5]);

    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      expect(request.type).toBe("rsc.transport.request");
      expect(request.operation).toBe("action");
      expect(request.actionId).toBe("do");

      endpoint.emitMessage({
        type: "rsc.transport.response.head",
        id: request.id,
        status: 200,
        headers: [["content-type", "text/plain"]],
      });
      endpoint.emitMessage({
        type: "rsc.transport.response.next",
        id: request.id,
        chunk: chunkA,
      });
      endpoint.emitMessage({
        type: "rsc.transport.response.next",
        id: request.id,
        chunk: chunkB,
      });
      endpoint.emitMessage({
        type: "rsc.transport.response.done",
        id: request.id,
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
    expect(response.body).toBeTruthy();

    const reader = response.body!.getReader();
    const first = await reader.read();
    const second = await reader.read();
    const third = await reader.read();

    expect(first.value).toEqual(chunkA);
    expect(second.value).toEqual(chunkB);
    expect(third.done).toBe(true);
  });

  it("worker transport emits canonical request envelope shape for action and fetch", async () => {
    const endpoint = new MockWorkerEndpoint();
    const seenRequests: WorkerTransportRequestMessage[] = [];

    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      seenRequests.push(request);
      endpoint.emitMessage({
        type: "rsc.transport.response.head",
        id: request.id,
        status: 200,
      });
      endpoint.emitMessage({
        type: "rsc.transport.response.done",
        id: request.id,
      });
    };

    const transport = createWorkerTransport(endpoint);
    await transport.sendAction({
      endpoint: "/rsc/action",
      actionId: "save",
      body: "[]",
      contentType: "text/plain",
    });
    await transport.fetchRSC?.({
      url: "/rsc/view",
      componentId: "mod#Comp",
      componentProps: { id: 1 },
    });

    expect(seenRequests).toHaveLength(2);
    expect(Object.keys(seenRequests[0] as object)).toEqual(CANONICAL_WORKER_REQUEST_KEYS);
    expect(Object.keys(seenRequests[1] as object)).toEqual(CANONICAL_WORKER_REQUEST_KEYS);
    expect(seenRequests[0]?.operation).toBe("action");
    expect(seenRequests[1]?.operation).toBe("fetch");
  });

  it("worker transport ignores interleaved mismatched response variants", async () => {
    const endpoint = new MockWorkerEndpoint();
    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      endpoint.emitMessage({
        type: "rsc.transport.response.next",
        id: request.id,
        chunk: Uint8Array.from([99]),
      });
      endpoint.emitMessage({
        type: "rsc.transport.response.head",
        id: request.id,
        status: 200,
      });
      endpoint.emitMessage({
        type: "rsc.transport.response.head",
        id: request.id,
        status: 201,
      });
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [flightDoneRow()],
      } satisfies WorkerRowResponseMessage);
      endpoint.emitMessage({
        type: "rsc.transport.response.next",
        id: request.id,
        chunk: Uint8Array.from([1, 2]),
      });
      endpoint.emitMessage({
        type: "rsc.transport.response.done",
        id: request.id,
      });
    };

    const transport = createWorkerTransport(endpoint);
    const response = await transport.sendAction({
      endpoint: "/rsc",
      actionId: "do",
      body: "[]",
      contentType: "text/plain",
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes)).toEqual([1, 2]);
  });

  it("worker transport reuses a single message listener across requests", async () => {
    const endpoint = new MockWorkerEndpoint();
    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      endpoint.emitMessage({
        type: "rsc.transport.response.head",
        id: request.id,
        status: 200,
      });
      endpoint.emitMessage({
        type: "rsc.transport.response.done",
        id: request.id,
      });
    };

    const transport = createWorkerTransport(endpoint);
    await transport.sendAction({
      endpoint: "/rsc",
      actionId: "a",
      body: "[]",
      contentType: "text/plain",
    });
    await transport.sendAction({
      endpoint: "/rsc",
      actionId: "b",
      body: "[]",
      contentType: "text/plain",
    });

    expect(endpoint.listenerCount()).toBe(1);
    expect(endpoint.addCalls).toBe(1);
    expect(endpoint.removeCalls).toBe(0);
  });

  it("worker transport times out before response head", async () => {
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

  it("worker transport times out mid-stream when no chunks arrive", async () => {
    const endpoint = new MockWorkerEndpoint();
    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      endpoint.emitMessage({
        type: "rsc.transport.response.head",
        id: request.id,
        status: 200,
        headers: [["content-type", "text/plain"]],
      });
    };

    const transport = createWorkerTransport(endpoint, { timeoutMs: 5 });
    const response = await transport.sendAction({
      endpoint: "/rsc",
      actionId: "do",
      body: "[]",
      contentType: "text/plain",
    });

    await expect(response.body!.getReader().read()).rejects.toThrow("Worker transport timed out");
  });

  it("worker message handler emits head/next/done frames", async () => {
    const postMessage = vi.fn();
    const onMessage = createWorkerTransportMessageHandler(async (request) => {
      expect(request.operation).toBe("fetch");
      expect(request.endpoint).toBe("/rsc");

      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(Uint8Array.from([10, 11]));
            controller.enqueue(Uint8Array.from([12]));
            controller.close();
          },
        }),
        {
          status: 207,
          headers: { "x-test": "1" },
        },
      );
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

    expect(postMessage.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        type: "rsc.transport.response.head",
        id: "abc",
        status: 207,
      }),
    );
    expect(postMessage.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        type: "rsc.transport.response.next",
        id: "abc",
        chunk: Uint8Array.from([10, 11, 12]),
      }),
    );
    expect(postMessage.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        type: "rsc.transport.response.done",
        id: "abc",
      }),
    );
  });

  it("worker message handler emits error frame on failure", async () => {
    const postMessage = vi.fn();
    const onMessage = createWorkerTransportMessageHandler(async () => {
      throw new Error("handler failed");
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
        type: "rsc.transport.response.error",
        id: "abc",
        error: "handler failed",
      }),
    );
  });

  it("worker fetch operation supports streaming protocol", async () => {
    const endpoint = new MockWorkerEndpoint();
    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      expect(request.operation).toBe("fetch");
      expect(request.componentId).toBe("worker-view.tsx#TodoWorkerView");
      expect(request.componentProps).toEqual({ filter: "active" });
      endpoint.emitMessage({
        type: "rsc.transport.response.head",
        id: request.id,
        status: 200,
        headers: [["content-type", "text/x-component"]],
      });
      endpoint.emitMessage({
        type: "rsc.transport.response.next",
        id: request.id,
        chunk: new TextEncoder().encode("RSC:1\n"),
      });
      endpoint.emitMessage({
        type: "rsc.transport.response.done",
        id: request.id,
      });
    };

    const transport = createWorkerTransport(endpoint);
    const response = await transport.fetchRSC?.({
      url: "/rsc",
      componentId: "worker-view.tsx#TodoWorkerView",
      componentProps: { filter: "active" },
    });
    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toBe("RSC:1\n");
  });

  it("worker row transport resolves rows directly", async () => {
    const endpoint = new MockWorkerEndpoint();
    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      expect(request.operation).toBe("fetch");
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [flightModelRow(0, "ok")],
      } satisfies WorkerRowResponseMessage);
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [flightDoneRow()],
      } satisfies WorkerRowResponseMessage);
    };

    const transport = createWorkerRowTransport(endpoint);
    await expect(
      transport.fetchRSCDirect?.<string>({
        url: "/rsc",
      }),
    ).resolves.toBe("ok");
  });

  it("worker row transport emits canonical request envelope shape", async () => {
    const endpoint = new MockWorkerEndpoint();
    const seenRequests: WorkerTransportRequestMessage[] = [];
    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      seenRequests.push(request);
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [flightModelRow(0, "ok")],
      } satisfies WorkerRowResponseMessage);
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [flightDoneRow()],
      } satisfies WorkerRowResponseMessage);
    };

    const transport = createWorkerRowTransport(endpoint);
    await expect(
      transport.fetchRSCDirect?.<string>({
        url: "/rsc",
      }),
    ).resolves.toBe("ok");

    expect(seenRequests).toHaveLength(1);
    expect(Object.keys(seenRequests[0] as object)).toEqual(CANONICAL_WORKER_REQUEST_KEYS);
  });

  it("worker row transport includes refresh targets and batch sequence for action direct requests", async () => {
    const endpoint = new MockWorkerEndpoint();
    const applyBatch = vi.fn();
    const legacyInvalidate = vi.fn();
    setRSCRefreshRuntime({
      collectTargets: () => [
        {
          targetKey: "worker-view.tsx#TodoWorkerView|props:{\"filter\":\"all\"}",
          componentId: "worker-view.tsx#TodoWorkerView",
          componentProps: { filter: "all" },
        },
      ],
      applyBatch,
      legacyInvalidate,
    });

    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      expect(request.refreshBatchSeq).toBe(1);
      expect(request.refreshTargets).toEqual([
        {
          targetKey: "worker-view.tsx#TodoWorkerView|props:{\"filter\":\"all\"}",
          componentId: "worker-view.tsx#TodoWorkerView",
          componentProps: { filter: "all" },
        },
      ]);
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [flightModelRow(0, "ok"), flightDoneRow()],
      } satisfies WorkerRowResponseMessage);
    };

    const transport = createWorkerRowTransport(endpoint, {
      experimentalActionBatchRefresh: true,
    });
    await expect(
      transport.sendActionDirect?.<string>({
        endpoint: "/rsc/action",
        actionId: "actions#save",
        body: "[]",
        contentType: "text/plain",
      }),
    ).resolves.toBe("ok");
    expect(applyBatch).not.toHaveBeenCalled();
    expect(legacyInvalidate).not.toHaveBeenCalled();
  });

  it("worker row transport falls back to legacy invalidate when no refresh targets are mounted", async () => {
    const endpoint = new MockWorkerEndpoint();
    const applyBatch = vi.fn();
    const legacyInvalidate = vi.fn();
    setRSCRefreshRuntime({
      collectTargets: () => [],
      applyBatch,
      legacyInvalidate,
    });

    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      expect(request.refreshBatchSeq).toBeUndefined();
      expect(request.refreshTargets).toBeUndefined();
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [flightModelRow(0, "ok"), flightDoneRow()],
      } satisfies WorkerRowResponseMessage);
    };

    const transport = createWorkerRowTransport(endpoint, {
      experimentalActionBatchRefresh: true,
    });
    await expect(
      transport.sendActionDirect?.<string>({
        endpoint: "/rsc/action",
        actionId: "actions#save",
        body: "[]",
        contentType: "text/plain",
      }),
    ).resolves.toBe("ok");
    expect(applyBatch).not.toHaveBeenCalled();
    expect(legacyInvalidate).toHaveBeenCalledTimes(1);
  });

  it("worker row transport applies action refresh batch metadata without legacy invalidate", async () => {
    const endpoint = new MockWorkerEndpoint();
    const applyBatch = vi.fn();
    const legacyInvalidate = vi.fn();
    setRSCRefreshRuntime({
      collectTargets: () => [
        {
          targetKey: "worker-view.tsx#TodoWorkerView|props:{\"filter\":\"all\"}",
          componentId: "worker-view.tsx#TodoWorkerView",
          componentProps: { filter: "all" },
        },
      ],
      applyBatch,
      legacyInvalidate,
    });

    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [flightModelRow(0, "ok"), flightDoneRow()],
        actionRefreshBatch: {
          seq: request.refreshBatchSeq ?? 0,
          entries: [
            {
              targetKey: "worker-view.tsx#TodoWorkerView|props:{\"filter\":\"all\"}",
              rows: [flightModelRow(0, "batched"), flightDoneRow()],
            },
          ],
        },
      } satisfies WorkerRowResponseMessage);
    };

    const transport = createWorkerRowTransport(endpoint, {
      experimentalActionBatchRefresh: true,
    });
    await expect(
      transport.sendActionDirect?.<string>({
        endpoint: "/rsc/action",
        actionId: "actions#save",
        body: "[]",
        contentType: "text/plain",
      }),
    ).resolves.toBe("ok");
    expect(applyBatch).toHaveBeenCalledTimes(1);
    const [appliedBatch, appliedCause] = applyBatch.mock.calls[0];
    expect(appliedBatch).toEqual({
      seq: 1,
      entries: [
        {
          targetKey: "worker-view.tsx#TodoWorkerView|props:{\"filter\":\"all\"}",
          rows: [flightModelRow(0, "batched"), flightDoneRow()],
          error: undefined,
        },
      ],
    });
    expect(appliedCause).toMatchObject({
      causeType: "action-batch-refresh",
      actionId: "actions#save",
      requestId: expect.any(String),
      generation: expect.any(Number),
      dispatchedAt: expect.any(Number),
    });
    expect(legacyInvalidate).not.toHaveBeenCalled();
  });

  it("worker row transport ignores stale action refresh batches", async () => {
    const endpoint = new MockWorkerEndpoint();
    const applyBatch = vi.fn();
    const legacyInvalidate = vi.fn();
    setRSCRefreshRuntime({
      collectTargets: () => [
        {
          targetKey: "worker-view.tsx#TodoWorkerView|props:{\"filter\":\"all\"}",
          componentId: "worker-view.tsx#TodoWorkerView",
          componentProps: { filter: "all" },
        },
      ],
      applyBatch,
      legacyInvalidate,
    });

    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      const emit = () => {
        endpoint.emitMessage({
          type: "rsc.transport.response.row",
          id: request.id,
          rows: [flightModelRow(0, request.actionId), flightDoneRow()],
          actionRefreshBatch: {
            seq: request.refreshBatchSeq ?? 0,
            entries: [
              {
                targetKey: "worker-view.tsx#TodoWorkerView|props:{\"filter\":\"all\"}",
                rows: [flightModelRow(0, request.actionId), flightDoneRow()],
              },
            ],
          },
        } satisfies WorkerRowResponseMessage);
      };
      if (request.actionId === "first") {
        setTimeout(emit, 20);
      } else {
        setTimeout(emit, 0);
      }
    };

    const transport = createWorkerRowTransport(endpoint, {
      experimentalActionBatchRefresh: true,
    });

    await Promise.all([
      transport.sendActionDirect?.<string>({
        endpoint: "/rsc/action",
        actionId: "first",
        body: "[]",
        contentType: "text/plain",
      }),
      transport.sendActionDirect?.<string>({
        endpoint: "/rsc/action",
        actionId: "second",
        body: "[]",
        contentType: "text/plain",
      }),
    ]);

    expect(applyBatch).toHaveBeenCalledTimes(1);
    const [appliedBatch, appliedCause] = applyBatch.mock.calls[0];
    expect(appliedBatch).toEqual({
      seq: 2,
      entries: [
        {
          targetKey: "worker-view.tsx#TodoWorkerView|props:{\"filter\":\"all\"}",
          rows: [flightModelRow(0, "second"), flightDoneRow()],
          error: undefined,
        },
      ],
    });
    expect(appliedCause).toMatchObject({
      causeType: "action-batch-refresh",
      actionId: "second",
      requestId: expect.any(String),
      generation: expect.any(Number),
      dispatchedAt: expect.any(Number),
    });
    expect(legacyInvalidate).not.toHaveBeenCalled();
  });

  it("worker row transport handles binary rows", async () => {
    const endpoint = new MockWorkerEndpoint();
    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      const bytes = Uint8Array.from([1, 2, 3]);
      const { row } = flightBinaryRow(1, "Uint8Array", bytes);
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [flightModelRow(0, "$1")],
      } satisfies WorkerRowResponseMessage);
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [row],
      } satisfies WorkerRowResponseMessage);
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [flightDoneRow()],
      } satisfies WorkerRowResponseMessage);
    };

    const transport = createWorkerRowTransport(endpoint);
    const value = await transport.fetchRSCDirect?.<Uint8Array>({
      url: "/rsc",
    });
    expect(Array.from(value ?? [])).toEqual([1, 2, 3]);
  });

  it("worker row transport resolves deferred rows", async () => {
    const endpoint = new MockWorkerEndpoint();
    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [flightModelRow(0, "$1")],
      } satisfies WorkerRowResponseMessage);
      setTimeout(() => {
        endpoint.emitMessage({
          type: "rsc.transport.response.row",
          id: request.id,
          rows: [flightModelRow(1, "ready")],
        } satisfies WorkerRowResponseMessage);
        endpoint.emitMessage({
          type: "rsc.transport.response.row",
          id: request.id,
          rows: [flightDoneRow()],
        } satisfies WorkerRowResponseMessage);
      }, 0);
    };

    const transport = createWorkerRowTransport(endpoint);
    await expect(
      transport.fetchRSCDirect?.<string>({
        url: "/rsc",
      }),
    ).resolves.toBe("ready");
  });

  it("worker row transport continues hydrating deferred chunks after root resolution", async () => {
    const endpoint = new MockWorkerEndpoint();
    endpoint.onPostMessage = (message) => {
      const request = message as WorkerTransportRequestMessage;
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [flightModelRow(0, "$1")],
      } satisfies WorkerRowResponseMessage);
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        rows: [flightModelRow(1, { first: "$2" })],
      } satisfies WorkerRowResponseMessage);
      setTimeout(() => {
        endpoint.emitMessage({
          type: "rsc.transport.response.row",
          id: request.id,
          rows: [flightModelRow(2, "ready")],
        } satisfies WorkerRowResponseMessage);
        endpoint.emitMessage({
          type: "rsc.transport.response.row",
          id: request.id,
          rows: [flightDoneRow()],
        } satisfies WorkerRowResponseMessage);
      }, 20);
    };

    const transport = createWorkerRowTransport(endpoint);
    const value = await transport.fetchRSCDirect?.<{ first: unknown }>({
      url: "/rsc",
    });

    const lazy = value?.first as {
      $$typeof?: symbol;
      _payload: unknown;
      _init: (payload: unknown) => unknown;
    };

    expect(String(lazy?.$$typeof)).toBe("Symbol(react.lazy)");

    let thrown: unknown;
    try {
      lazy._init(lazy._payload);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    expect(typeof (thrown as { then?: unknown }).then).toBe("function");

    await expect(
      Promise.race([
        Promise.resolve(thrown).then(() => "resolved"),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 200)),
      ]),
    ).resolves.toBe("resolved");

    expect(lazy._init(lazy._payload)).toBe("ready");
  });

  it("worker row transport times out", async () => {
    const endpoint = new MockWorkerEndpoint();
    const transport = createWorkerRowTransport(endpoint, { timeoutMs: 5 });

    await expect(
      transport.fetchRSCDirect?.({
        url: "/rsc",
      }),
    ).rejects.toThrow("Worker transport timed out");
  });

  it("worker row message handler batches row frames", async () => {
    const postMessage = vi.fn();
    const onMessage = createWorkerRowTransportMessageHandler(async (request, emit) => {
      expect(request.operation).toBe("fetch");
      emit(flightModelRow(0, "$1"));
      const { row, transfer } = flightBinaryRow(1, "Uint8Array", Uint8Array.from([7, 8]));
      emit(row, transfer);
      emit(flightDoneRow());
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

    expect(postMessage.mock.calls).toHaveLength(1);
    expect(postMessage.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        type: "rsc.transport.response.row",
        id: "abc",
        rows: [flightModelRow(0, "$1"), expect.objectContaining({ k: 1 }), flightDoneRow()],
      }),
    );
    expect(postMessage.mock.calls[0]?.[1]).toEqual(expect.any(Array));
  });

  it("worker row message handler includes action refresh batch metadata", async () => {
    const postMessage = vi.fn();
    const onMessage = createWorkerRowTransportMessageHandler(async (_request, emit, controls) => {
      controls.setActionRefreshBatch({
        seq: 7,
        entries: [{ targetKey: "mod#Comp|props:{}", rows: [flightModelRow(0, "next"), flightDoneRow()] }],
      });
      emit(flightModelRow(0, "ok"));
      emit(flightDoneRow());
    });

    await onMessage({
      data: {
        type: "rsc.transport.request",
        id: "abc",
        operation: "action",
        endpoint: "/rsc/action",
      },
      currentTarget: { postMessage },
    } as unknown as MessageEvent<unknown>);

    expect(postMessage.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        type: "rsc.transport.response.row",
        id: "abc",
        actionRefreshBatch: {
          seq: 7,
          entries: [
            {
              targetKey: "mod#Comp|props:{}",
              rows: [flightModelRow(0, "next"), flightDoneRow()],
            },
          ],
        },
      }),
    );
  });

  it("worker row message handler emits error row on failure", async () => {
    const postMessage = vi.fn();
    const onMessage = createWorkerRowTransportMessageHandler(async () => {
      throw new Error("handler failed");
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
        type: "rsc.transport.response.row",
        id: "abc",
        rows: [expect.objectContaining({ k: ROW_ERROR, v: "handler failed" })],
      }),
    );
  });
});
