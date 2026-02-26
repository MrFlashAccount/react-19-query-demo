import { beforeEach, describe, expect, it } from "vitest";

import {
  callAction,
  createCallServer,
  encodeActionArgs,
  fetchRSC,
} from "../src/client";
import { DEFAULT_WORKER_RUNTIME_GLOBAL_KEY, setInvalidateRSC } from "../src/runtime-globals";
import { createMockWorkerTransport } from "./utils/mock-worker-transport";
import { setAutoClientManifest, resolveClientManifestOrThrow } from "../src/runtime/client-manifest";
import { createFromRowEmitter } from "../src/flight-runtime/client";
function clearDefaultWorkerRuntimeGlobals() {
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  delete globalState[DEFAULT_WORKER_RUNTIME_GLOBAL_KEY];
}

describe("rsc client browser workflows", () => {
  beforeEach(() => {
    setInvalidateRSC(() => {});
    setAutoClientManifest("/");
  });

  it("notifies late then subscribers when deferred row chunks have already settled", async () => {
    const emitter = createFromRowEmitter<{ first: unknown }>();
    emitter.push({ k: 0, id: 0, v: "$1" });
    emitter.push({ k: 0, id: 1, v: { first: "$2" } });
    emitter.push({ k: 0, id: 2, v: "ready" });
    emitter.push({ k: 2 });

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
      actionId: string | null;
    }> = [];
    const transport = createMockWorkerTransport(async (request) => {
      seenRequests.push({
        operation: request.operation,
        actionId: request.actionId ?? null,
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
    await expect(callAction<string>(runActionRef, [1], { transport })).resolves.toBe("action-ok");

    expect(seenRequests[0]).toEqual({
      operation: "fetch",
      actionId: null,
    });
    expect(seenRequests[1]).toEqual({
      operation: "action",
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
    const transport = createMockWorkerTransport(async (request) => {
      seenActionIds.push(request.actionId ?? "");
      return "call-server-ok";
    });

    const callServer = createCallServer({ transport });
    await expect(callServer("increment", [1])).resolves.toBe("call-server-ok");
    expect(seenActionIds).toEqual(["increment"]);
  });

  it("surfaces flight-streamed action errors", async () => {
    const transport = createMockWorkerTransport(async (request) => {
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

    const manifest = resolveClientManifestOrThrow();
    const transport = createMockWorkerTransport(async (request) => {
      if (request.operation === "fetch") {
        const emitter = createFromRowEmitter<string>({ manifest });
        emitter.push({ k: 0, id: 0, v: "$C/alias/view#default" });
        emitter.push({ k: 2 });
        return emitter.result;
      }
      return null;
    });

    await expect(fetchRSC("/rsc/view", { transport })).resolves.toBe("client-view-ok");
  });
});
