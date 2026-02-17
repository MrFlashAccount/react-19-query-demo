import { beforeEach, describe, expect, it } from "vitest";

import { callAction, consumeRSCResponse, createCallServer, encodeActionArgs, fetchRSC } from "../src/client";
import { DEFAULT_WORKER_RUNTIME_GLOBAL_KEY, setInvalidateRSC } from "../src/runtime-globals";
import { createFunctionTransport } from "../src/transport";

function flightValueResponse(value: unknown): Response {
  return new Response(`0:${JSON.stringify(value)}\n`, {
    status: 200,
    headers: { "content-type": "text/x-component" },
  });
}

function clearDefaultWorkerRuntimeGlobals() {
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  delete globalState[DEFAULT_WORKER_RUNTIME_GLOBAL_KEY];
}

describe("rsc client browser workflows", () => {
  beforeEach(() => {
    setInvalidateRSC(() => {});
  });

  it("consumes flight response payloads", async () => {
    await expect(consumeRSCResponse<string>(flightValueResponse("flight-ok"))).resolves.toBe("flight-ok");
  });

  it("parses split flight stream chunks incrementally", async () => {
    const payload = `0:${JSON.stringify("stream-✓")}\n`;
    const bytes = new TextEncoder().encode(payload);
    const splitAt = Math.max(1, bytes.length - 2);

    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice(0, splitAt));
          controller.enqueue(bytes.slice(splitAt));
          controller.close();
        },
      }),
      {
        status: 200,
        headers: { "content-type": "text/x-component" },
      },
    );

    await expect(consumeRSCResponse<string>(response)).resolves.toBe("stream-✓");
  });

  it("resolves before stream close once 0-row arrives", async () => {
    const payload = `0:${JSON.stringify("early")}\n`;
    let closeStream: (() => void) | null = null;

    const response = new Response(
      new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(payload));
          await new Promise<void>((resolve) => {
            closeStream = resolve;
          });
          controller.close();
        },
        cancel() {
          if (closeStream != null) {
            closeStream();
          }
        },
      }),
      {
        status: 200,
        headers: { "content-type": "text/x-component" },
      },
    );

    const resultPromise = consumeRSCResponse<string>(response);
    const raced = await Promise.race([
      resultPromise.then(() => "resolved"),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 100)),
    ]);

    expect(raced).toBe("resolved");
    await expect(resultPromise).resolves.toBe("early");
    closeStream?.();
  });

  it("resolves root row references once deferred rows arrive", async () => {
    let releaseClose: (() => void) | null = null;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify({ $t: "rowRef", id: 1 })}\n`));
          await new Promise((resolve) => setTimeout(resolve, 10));
          controller.enqueue(new TextEncoder().encode(`1:${JSON.stringify("deferred")}\n`));
          await new Promise<void>((resolve) => {
            releaseClose = resolve;
          });
          controller.close();
        },
        cancel() {
          releaseClose?.();
        },
      }),
      {
        status: 200,
        headers: { "content-type": "text/x-component" },
      },
    );

    const resultPromise = consumeRSCResponse<string>(response);
    const raced = await Promise.race([
      resultPromise.then(() => "resolved"),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 100)),
    ]);

    expect(raced).toBe("resolved");
    await expect(resultPromise).resolves.toBe("deferred");
    releaseClose?.();
  });

  it("encodes action args and supports fetch/call workflows", async () => {
    const encoded = await encodeActionArgs([1, "x"]);
    if (encoded.type === "string") {
      expect(encoded.data.length).toBeGreaterThan(0);
    } else {
      expect(Array.from(encoded.data.entries()).length).toBeGreaterThan(0);
    }

    const seenRequests: Array<{ method: string; url: string; accept: string | null; actionId: string | null }> = [];
    const transport = createFunctionTransport(async (request) => {
      seenRequests.push({
        method: request.method,
        url: request.url,
        accept: request.headers.get("accept"),
        actionId: request.headers.get("x-rsc-action"),
      });

      if (request.method === "GET") {
        return flightValueResponse("fetch-ok");
      }

      return flightValueResponse("action-ok");
    });

    const runActionRef = {
      $$typeof: Symbol.for("react.server.reference"),
      $$id: "todo-actions.ts#run",
      $$bound: null,
    };
    await expect(fetchRSC<string>("/rsc", { transport })).resolves.toBe("fetch-ok");
    await expect(callAction<string>(runActionRef, [1], { transport, parseResponse: true })).resolves.toBe("action-ok");

    expect(seenRequests[0]).toEqual({
      method: "GET",
      url: "/rsc/view",
      accept: "text/x-component",
      actionId: null,
    });
    expect(seenRequests[1]).toEqual({
      method: "POST",
      url: "/rsc/action",
      accept: null,
      actionId: "todo-actions.ts#run",
    });
  });

  it("rejects non-reference action calls", async () => {
    await expect(callAction("not-a-ref" as unknown as (...args: never[]) => unknown, [])).rejects.toThrow(
      "expects a \"use worker\" action reference",
    );
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
    const transport = createFunctionTransport(async (request) => {
      seenActionIds.push(request.headers.get("x-rsc-action") ?? "");
      return flightValueResponse("call-server-ok");
    });

    const callServer = createCallServer("/rsc/action", { transport });
    await expect(callServer("increment", [1])).resolves.toBe("call-server-ok");
    expect(seenActionIds).toEqual(["increment"]);
  });
});
