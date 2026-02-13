import { describe, expect, it } from "vitest";

import {
  callAction,
  consumeRSCResponse,
  createCallServer,
  createServiceWorkerTransport,
  encodeActionArgs,
  fetchRSC,
} from "../../src/rsc/client";
import { createFunctionTransport } from "@lib/rsc-prism/transport";

function flightValueResponse(value: unknown): Response {
  return new Response(`0:${JSON.stringify(value)}\n`, {
    status: 200,
    headers: { "content-type": "text/x-component" },
  });
}

describe("rsc client browser workflows", () => {
  it("consumes flight responses and encodes action payloads", async () => {
    await expect(consumeRSCResponse<string>(flightValueResponse("flight-ok"))).resolves.toBe("flight-ok");

    const encoded = await encodeActionArgs([1, "x"]);
    if (encoded.type === "string") {
      expect(encoded.data.length).toBeGreaterThan(0);
    } else {
      expect(Array.from(encoded.data.entries()).length).toBeGreaterThan(0);
    }
  });

  it("runs fetch and action workflows using transport", async () => {
    const seenMethods: string[] = [];
    const seenActionIds: string[] = [];

    const transport = createFunctionTransport(async (request) => {
      seenMethods.push(request.method);
      seenActionIds.push(request.headers.get("x-rsc-action") ?? "");
      if (request.method === "GET") {
        expect(request.headers.get("accept")).toBe("text/x-component");
        return flightValueResponse("fetch-ok");
      }
      return flightValueResponse("action-ok");
    });

    await expect(fetchRSC<string>("/rsc", { transport, waitForReady: false })).resolves.toBe("fetch-ok");
    await expect(
      callAction<string>("/rsc", "run", [1], { transport, parseResponse: true, waitForReady: false }),
    ).resolves.toBe("action-ok");

    const callServer = createCallServer("/rsc/action", { transport, waitForReady: false });
    await expect(callServer("increment", [2])).resolves.toBe("action-ok");

    expect(seenMethods).toEqual(["GET", "POST", "POST"]);
    expect(seenActionIds).toEqual(["", "run", "increment"]);
  });

  it("sets expected headers in service-worker transport", async () => {
    const originalFetch = globalThis.fetch;
    const seen: Array<{ accept: string | null; action: string | null; contentType: string | null }> = [];

    globalThis.fetch = (async (_input, init) => {
      const headers = new Headers(init?.headers);
      seen.push({
        accept: headers.get("accept"),
        action: headers.get("x-rsc-action"),
        contentType: headers.get("content-type"),
      });
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const transport = createServiceWorkerTransport({ waitForReady: false });
    await transport.fetchRSC?.({ url: "/rsc" });
    await transport.sendAction({ endpoint: "/rsc", actionId: "run", body: "[]", contentType: "text/plain" });

    expect(seen[0]).toEqual({
      accept: "text/x-component",
      action: null,
      contentType: null,
    });
    expect(seen[1]).toEqual({
      accept: null,
      action: "run",
      contentType: "text/plain",
    });

    globalThis.fetch = originalFetch;
  });
});
