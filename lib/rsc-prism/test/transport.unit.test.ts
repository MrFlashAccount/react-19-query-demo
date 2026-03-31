import { beforeEach, describe, expect, it, vi } from "vitest";
import { setInvalidateRSC, setRSCRefreshRuntime } from "../src/runtime-globals";

import {
  createWorkerRowTransport,
  createWorkerRowTransportMessageHandler,
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
  "actionId",
  "body",
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

  it("worker row transport emits canonical request envelope shape for action and fetch", async () => {
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
    await transport.sendActionDirect?.({
      actionId: "save",
      body: "[]",
    });
    await transport.fetchRSCDirect?.({
      componentId: "mod#Comp",
      componentProps: { id: 1 },
    });

    expect(seenRequests).toHaveLength(2);
    expect(Object.keys(seenRequests[0] as object)).toEqual(CANONICAL_WORKER_REQUEST_KEYS);
    expect(Object.keys(seenRequests[1] as object)).toEqual(CANONICAL_WORKER_REQUEST_KEYS);
    expect(seenRequests[0]?.operation).toBe("action");
    expect(seenRequests[1]?.operation).toBe("fetch");
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
        componentId: "mod#Comp",
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
        componentId: "mod#Comp",
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
          targetKey: 'worker-view.tsx#TodoWorkerView|props:{"filter":"all"}',
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
          targetKey: 'worker-view.tsx#TodoWorkerView|props:{"filter":"all"}',
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
        actionId: "actions#save",
        body: "[]",
      }),
    ).resolves.toBe("ok");
    expect(applyBatch).not.toHaveBeenCalled();
    expect(legacyInvalidate).not.toHaveBeenCalled();
  });

  it("worker row transport resolves undefined action results during batched refresh", async () => {
    const endpoint = new MockWorkerEndpoint();
    const applyBatch = vi.fn();
    const legacyInvalidate = vi.fn();
    setRSCRefreshRuntime({
      collectTargets: () => [
        {
          targetKey: 'worker-view.tsx#TodoWorkerView|props:{"filter":"all"}',
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
        rows: [flightModelRow(0, undefined), flightDoneRow()],
      } satisfies WorkerRowResponseMessage);
    };

    const transport = createWorkerRowTransport(endpoint, {
      experimentalActionBatchRefresh: true,
    });
    await expect(
      transport.sendActionDirect({
        actionId: "actions#save",
        body: "[]",
      }),
    ).resolves.toBeUndefined();
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
        actionId: "actions#save",
        body: "[]",
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
          targetKey: 'worker-view.tsx#TodoWorkerView|props:{"filter":"all"}',
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
              targetKey: 'worker-view.tsx#TodoWorkerView|props:{"filter":"all"}',
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
        actionId: "actions#save",
        body: "[]",
      }),
    ).resolves.toBe("ok");
    expect(applyBatch).toHaveBeenCalledTimes(1);
    const [appliedBatch] = applyBatch.mock.calls[0];
    expect(appliedBatch).toEqual({
      seq: 1,
      entries: [
        {
          targetKey: 'worker-view.tsx#TodoWorkerView|props:{"filter":"all"}',
          rows: [flightModelRow(0, "batched"), flightDoneRow()],
          error: undefined,
        },
      ],
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
          targetKey: 'worker-view.tsx#TodoWorkerView|props:{"filter":"all"}',
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
                targetKey: 'worker-view.tsx#TodoWorkerView|props:{"filter":"all"}',
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
        actionId: "first",
        body: "[]",
      }),
      transport.sendActionDirect?.<string>({
        actionId: "second",
        body: "[]",
      }),
    ]);

    expect(applyBatch).toHaveBeenCalledTimes(1);
    const [appliedBatch] = applyBatch.mock.calls[0];
    expect(appliedBatch).toEqual({
      seq: 2,
      entries: [
        {
          targetKey: 'worker-view.tsx#TodoWorkerView|props:{"filter":"all"}',
          rows: [flightModelRow(0, "second"), flightDoneRow()],
          error: undefined,
        },
      ],
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
      componentId: "mod#Comp",
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
        componentId: "mod#Comp",
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
      componentId: "mod#Comp",
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
        componentId: "mod#Comp",
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
        componentId: "mod#Comp",
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

  it("worker row message handler flushes rows per microtask chunk", async () => {
    const postMessage = vi.fn();
    const onMessage = createWorkerRowTransportMessageHandler(async (_request, emit) => {
      emit(flightModelRow(0, "$1"));
      await Promise.resolve();
      emit(flightModelRow(1, "resolved"));
      emit(flightDoneRow());
    });

    await onMessage({
      data: {
        type: "rsc.transport.request",
        id: "abc",
        operation: "fetch",
        componentId: "mod#Comp",
      },
      currentTarget: { postMessage },
    } as unknown as MessageEvent<unknown>);

    expect(postMessage.mock.calls).toHaveLength(2);
    expect(postMessage.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        type: "rsc.transport.response.row",
        id: "abc",
        rows: [flightModelRow(0, "$1")],
      }),
    );
    expect(postMessage.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        type: "rsc.transport.response.row",
        id: "abc",
        rows: [flightModelRow(1, "resolved"), flightDoneRow()],
      }),
    );
  });

  it("worker row message handler includes action refresh batch metadata", async () => {
    const postMessage = vi.fn();
    const onMessage = createWorkerRowTransportMessageHandler(async (_request, emit, controls) => {
      controls.setActionRefreshBatch({
        seq: 7,
        entries: [
          { targetKey: "mod#Comp|props:{}", rows: [flightModelRow(0, "next"), flightDoneRow()] },
        ],
      });
      emit(flightModelRow(0, "ok"));
      emit(flightDoneRow());
    });

    await onMessage({
      data: {
        type: "rsc.transport.request",
        id: "abc",
        operation: "action",
        actionId: "mod#save",
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
        componentId: "mod#Comp",
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
