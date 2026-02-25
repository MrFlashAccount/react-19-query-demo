import { beforeEach, describe, expect, it } from "vitest";

import {
  callAction,
  createCallServer,
  encodeActionArgs,
  fetchRSC,
} from "../src/client";
import { DEFAULT_WORKER_RUNTIME_GLOBAL_KEY, setInvalidateRSC } from "../src/runtime-globals";
import { createMockWorkerRowTransport } from "./utils/mock-worker-transport";
import { resolveClientManifestOrThrow, setAutoClientManifest } from "../src/runtime/client-manifest";
import { createFromRowEmitter } from "../src/flight-runtime/client";
import { ROW_BINARY, ROW_DONE, ROW_MODEL } from "../src/flight-runtime/wire";

function clearDefaultWorkerRuntimeGlobals() {
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  delete globalState[DEFAULT_WORKER_RUNTIME_GLOBAL_KEY];
}

describe("rsc client browser workflows", () => {
  beforeEach(() => {
    setInvalidateRSC(() => {});
    setAutoClientManifest("/");
  });

  it("consumes flight row payloads via createFromRowEmitter", async () => {
    const emitter = createFromRowEmitter<string>();
    emitter.push({ k: ROW_MODEL, id: 0, v: "flight-ok" });
    emitter.push({ k: ROW_DONE });
    await expect(emitter.result).resolves.toBe("flight-ok");
  });

  it("parses row payloads via createFromRowEmitter", async () => {
    const emitter = createFromRowEmitter<string>();
    emitter.push({ k: ROW_MODEL, id: 0, v: "stream-✓" });
    emitter.push({ k: ROW_DONE });
    await expect(emitter.result).resolves.toBe("stream-✓");
  });

  it("resolves root row references once deferred rows arrive", async () => {
    const emitter = createFromRowEmitter<string>();
    emitter.push({ k: ROW_MODEL, id: 0, v: { $t: "rowRef", id: 1 } });
    emitter.push({ k: ROW_MODEL, id: 1, v: "deferred" });
    emitter.push({ k: ROW_DONE });
    await expect(emitter.result).resolves.toBe("deferred");
  });

  it("decodes binary row payloads via createFromRowEmitter", async () => {
    const deferredBytes = Uint8Array.from([7, 8, 9, 10]);
    const emitter = createFromRowEmitter<ArrayBuffer>();
    emitter.push({ k: ROW_MODEL, id: 0, v: { $t: "rowRef", id: 1 } });
    emitter.push({ k: ROW_BINARY, id: 1, t: "A", v: deferredBytes.buffer });
    emitter.push({ k: ROW_DONE });
    const decoded = await emitter.result;
    expect(Array.from(new Uint8Array(decoded))).toEqual(Array.from(deferredBytes));
  });

  it("notifies late then subscribers when deferred row chunks have already settled", async () => {
    const emitter = createFromRowEmitter<{ first: unknown }>();
    emitter.push({ k: ROW_MODEL, id: 0, v: { first: { $t: "rowRef", id: 2 } } });
    emitter.push({ k: ROW_MODEL, id: 1, v: null });
    emitter.push({ k: ROW_MODEL, id: 2, v: "ready" });
    emitter.push({ k: ROW_DONE });

    const value = await emitter.result;
    const lazy = value.first as {
      $$typeof?: symbol;
      _payload: { then: (resolve: () => void, reject?: (reason: unknown) => void) => void };
      _init: (payload: unknown) => unknown;
    };

    expect(String(lazy?.$$typeof)).toBe("Symbol(react.lazy)");

    let resolved = false;
    lazy._payload.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(true);
    expect(lazy._init(lazy._payload)).toBe("ready");
  });

  it("encodes action args and supports fetch/call workflows", async () => {
    const encoded = await encodeActionArgs([1, "x"]);
    if (encoded.type === "string") {
      expect(encoded.data.length).toBeGreaterThan(0);
    } else if (encoded.data instanceof FormData) {
      expect(Array.from(encoded.data.entries()).length).toBeGreaterThan(0);
    } else {
      expect(encoded.data.length).toBeGreaterThan(0);
    }

    const seenRequests: Array<{
      operation: string;
      endpoint: string;
      accept: string | null;
      actionId: string | null;
    }> = [];
    const transport = createMockWorkerRowTransport(async (request) => {
      const headers = request.headers ?? [];
      const headersMap = new Map(headers);
      seenRequests.push({
        operation: request.operation,
        endpoint: request.endpoint,
        accept: headersMap.get("accept") ?? null,
        actionId: request.actionId ?? headersMap.get("x-rsc-action") ?? null,
      });

      if (request.operation === "fetch") {
        return "fetch-ok";
      }

      return "action-ok";
    });

    const runActionRef = {
      $$typeof: Symbol.for("react.server.reference"),
      $$id: "todo-actions.ts#run",
      $$bound: null,
    };
    await expect(fetchRSC("/rsc", { transport })).resolves.toBe("fetch-ok");
    await expect(
      callAction<string>(runActionRef, [1], { transport, parseResponse: true }),
    ).resolves.toBe("action-ok");

    expect(seenRequests[0]).toEqual({
      operation: "fetch",
      endpoint: "/rsc/view",
      accept: "text/x-component",
      actionId: null,
    });
    expect(seenRequests[1]).toEqual({
      operation: "action",
      endpoint: "/rsc/action",
      accept: null,
      actionId: "todo-actions.ts#run",
    });
  });

  it("rejects non-reference action calls", async () => {
    await expect(
      callAction("not-a-ref" as unknown as (...args: never[]) => unknown, []),
    ).rejects.toThrow('expects a "use worker" action reference');
  });

  it("throws when fetchRSC has no explicit or bootstrapped transport", async () => {
    clearDefaultWorkerRuntimeGlobals();
    await expect(fetchRSC("/rsc")).rejects.toThrow("Missing RSC transport");
  });

  it("throws when callAction has no explicit or bootstrapped transport", async () => {
    clearDefaultWorkerRuntimeGlobals();
    const runActionRef = {
      $$typeof: Symbol.for("react.server.reference"),
      $$id: "todo-actions.ts#run",
      $$bound: null,
    };

    await expect(callAction(runActionRef, [])).rejects.toThrow("Missing RSC transport");
  });

  it("creates callServer function that posts action request", async () => {
    const seenActionIds: string[] = [];
    const transport = createMockWorkerRowTransport(async (request) => {
      seenActionIds.push(request.actionId ?? "");
      return "call-server-ok";
    });

    const callServer = createCallServer("/rsc/action", { transport });
    await expect(callServer("increment", [1])).resolves.toBe("call-server-ok");
    expect(seenActionIds).toEqual(["increment"]);
  });

  it("surfaces flight-streamed action errors", async () => {
    const transport = createMockWorkerRowTransport(async (request) => {
      if (request.operation === "action") {
        throw new Error("Action exploded");
      }
      return "ok";
    });

    const runActionRef = {
      $$typeof: Symbol.for("react.server.reference"),
      $$id: "todo-actions.ts#run",
      $$bound: null,
    };

    await expect(callAction(runActionRef, [1], { transport })).rejects.toThrow("Action exploded");
  });

  it("resolves client refs via auto manifest map entries", async () => {
    const moduleKey = "__rscPrismMainThreadModules";
    const globalState = globalThis as typeof globalThis & Record<string, unknown>;
    globalState[moduleKey] = {
      "/src/client-components.tsx": {
        TodoClientView: "client-view-ok",
      },
    };

    setAutoClientManifest({
      "/alias/view#default": {
        id: "/src/client-components.tsx",
        name: "TodoClientView",
        chunks: [],
      },
    });

    const emitter = createFromRowEmitter<string>({ manifest: resolveClientManifestOrThrow() });
    emitter.push({ k: ROW_MODEL, id: 0, v: { $t: "clientRef", id: "/alias/view#default" } });
    emitter.push({ k: ROW_DONE });

    await expect(emitter.result).resolves.toBe("client-view-ok");
  });
});
