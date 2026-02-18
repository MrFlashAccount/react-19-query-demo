import { beforeEach, describe, expect, it, vi } from "vitest";
import { setInvalidateRSC } from "../src/runtime-globals";

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

describe("transport", () => {
  beforeEach(() => {
    setInvalidateRSC(() => {});
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
        row: flightModelRow(0, "ok"),
      } satisfies WorkerRowResponseMessage);
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        row: flightDoneRow(),
      } satisfies WorkerRowResponseMessage);
    };

    const transport = createWorkerRowTransport(endpoint);
    await expect(
      transport.fetchRSCDirect?.<string>({
        url: "/rsc",
      }),
    ).resolves.toBe("ok");
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
        row: flightModelRow(0, "$1"),
      } satisfies WorkerRowResponseMessage);
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        row,
      } satisfies WorkerRowResponseMessage);
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        row: flightDoneRow(),
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
        row: flightModelRow(0, "$1"),
      } satisfies WorkerRowResponseMessage);
      setTimeout(() => {
        endpoint.emitMessage({
          type: "rsc.transport.response.row",
          id: request.id,
          row: flightModelRow(1, "ready"),
        } satisfies WorkerRowResponseMessage);
        endpoint.emitMessage({
          type: "rsc.transport.response.row",
          id: request.id,
          row: flightDoneRow(),
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
        row: flightModelRow(0, "$1"),
      } satisfies WorkerRowResponseMessage);
      endpoint.emitMessage({
        type: "rsc.transport.response.row",
        id: request.id,
        row: flightModelRow(1, { first: "$2" }),
      } satisfies WorkerRowResponseMessage);
      setTimeout(() => {
        endpoint.emitMessage({
          type: "rsc.transport.response.row",
          id: request.id,
          row: flightModelRow(2, "ready"),
        } satisfies WorkerRowResponseMessage);
        endpoint.emitMessage({
          type: "rsc.transport.response.row",
          id: request.id,
          row: flightDoneRow(),
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

  it("worker row message handler emits row frames", async () => {
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

    expect(postMessage.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        type: "rsc.transport.response.row",
        id: "abc",
      }),
    );
    expect(postMessage.mock.calls[1]?.[1]).toEqual(expect.any(Array));
    expect(postMessage.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        type: "rsc.transport.response.row",
        id: "abc",
        row: flightDoneRow(),
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
        row: expect.objectContaining({
          k: ROW_ERROR,
          v: "handler failed",
        }),
      }),
    );
  });
});
