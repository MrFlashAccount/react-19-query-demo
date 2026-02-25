import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as clientOnly from "../src/client-only";
import {
  DEFAULT_WORKER_RUNTIME_GLOBAL_KEY,
  WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY,
  setInvalidateRSC,
} from "../src/runtime-globals";
import { createMockWorkerTransport } from "./utils/mock-worker-transport";

const initialWorkerBootstrap = (globalThis as typeof globalThis & Record<string, unknown>)[
  WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY
];

function flightValueResponse(value: unknown): Response {
  return new Response(`0:${JSON.stringify(value)}\n`, {
    status: 200,
    headers: { "content-type": "text/x-component" },
  });
}

describe("client-only browser workflows", () => {
  beforeEach(() => {
    setInvalidateRSC(() => {});
  });
  afterEach(() => {
    const target = globalThis as typeof globalThis & Record<string, unknown>;
    if (initialWorkerBootstrap === undefined) {
      delete target[WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY];
    } else {
      target[WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY] = initialWorkerBootstrap;
    }
    delete target[DEFAULT_WORKER_RUNTIME_GLOBAL_KEY];
  });

  it("runs fetch/action flows from the narrowed client-only surface", async () => {
    const clientOnlyApi = clientOnly as unknown as Record<string, unknown>;
    expect(clientOnlyApi.registerClientModule).toBeUndefined();
    expect(clientOnlyApi.createWorkerTransport).toBeUndefined();

    const transport = createMockWorkerTransport(async (request) => {
      if (request.operation === "fetch") {
        return flightValueResponse("fetch-ok");
      }
      return flightValueResponse("action-ok");
    });
    const runActionRef = {
      $$typeof: Symbol.for("react.server.reference"),
      $$id: "todo-actions.ts#run",
      $$bound: null,
    };

    await expect(clientOnly.fetchRSC("/rsc" as any, { transport })).resolves.toBe("fetch-ok");
    await expect(
      clientOnly.callAction<string>(runActionRef, [1], { transport, parseResponse: true }),
    ).resolves.toBe("action-ok");
  });

  it("bootstraps worker runtime and uses the bootstrapped runtime transport", async () => {
    const seenRequests: Array<{ operation: string; actionId: string | null }> = [];
    const transport = createMockWorkerTransport(async (request) => {
      seenRequests.push({
        operation: request.operation,
        actionId: request.actionId ?? null,
      });
      if (request.operation === "fetch") {
        return flightValueResponse("default-fetch-ok");
      }
      return flightValueResponse("default-action-ok");
    });
    const runActionRef = {
      $$typeof: Symbol.for("react.server.reference"),
      $$id: "todo-actions.ts#run",
      $$bound: null,
    };
    const dispose = vi.fn();
    const runtime = {
      worker: {} as Worker,
      transport,
      dispose,
    };
    const bootstrap = vi.fn(async () => runtime);
    (globalThis as typeof globalThis & Record<string, unknown>)[
      WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY
    ] = bootstrap;

    const bootstrapped = await clientOnly.bootstrapWorkerRuntime();
    expect(bootstrapped).toBe(runtime);
    expect(bootstrap).toHaveBeenCalledTimes(1);

    await expect(clientOnly.fetchRSC("/rsc" as any)).resolves.toBe("default-fetch-ok");
    await expect(
      clientOnly.callAction<string>(runActionRef, [1], { parseResponse: true }),
    ).resolves.toBe("default-action-ok");
    expect(seenRequests).toEqual([
      { operation: "fetch", actionId: null },
      { operation: "action", actionId: "todo-actions.ts#run" },
    ]);

    bootstrapped.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    await expect(clientOnly.fetchRSC("/rsc" as any)).rejects.toThrow("Missing RSC transport");
  });

  it("throws when worker runtime bootstrap hook is unavailable", async () => {
    delete (globalThis as typeof globalThis & Record<string, unknown>)[
      WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY
    ];
    await expect(clientOnly.bootstrapWorkerRuntime()).rejects.toThrow(
      "Worker runtime bootstrap is unavailable",
    );
  });
});
