import { describe, expect, it } from "vitest";

import { callAction, consumeRSCResponse, createCallServer, encodeActionArgs, fetchRSC } from "../src/client";
import { createFunctionTransport } from "../src/transport";

function flightValueResponse(value: unknown): Response {
  return new Response(`0:${JSON.stringify(value)}\n`, {
    status: 200,
    headers: { "content-type": "text/x-component" },
  });
}

describe("rsc client browser workflows", () => {
  it("consumes flight response payloads", async () => {
    await expect(consumeRSCResponse<string>(flightValueResponse("flight-ok"))).resolves.toBe("flight-ok");
  });

  it("encodes action args and supports fetch/call workflows", async () => {
    const encoded = await encodeActionArgs([1, "x"]);
    if (encoded.type === "string") {
      expect(encoded.data.length).toBeGreaterThan(0);
    } else {
      expect(Array.from(encoded.data.entries()).length).toBeGreaterThan(0);
    }

    const seenRequests: Array<{ method: string; accept: string | null; actionId: string | null }> = [];
    const transport = createFunctionTransport(async (request) => {
      seenRequests.push({
        method: request.method,
        accept: request.headers.get("accept"),
        actionId: request.headers.get("x-rsc-action"),
      });

      if (request.method === "GET") {
        return flightValueResponse("fetch-ok");
      }

      return flightValueResponse("action-ok");
    });

    await expect(fetchRSC<string>("/rsc", { transport })).resolves.toBe("fetch-ok");
    await expect(callAction<string>("/rsc", "run", [1], { transport, parseResponse: true })).resolves.toBe(
      "action-ok",
    );

    expect(seenRequests[0]).toEqual({
      method: "GET",
      accept: "text/x-component",
      actionId: null,
    });
    expect(seenRequests[1]).toEqual({
      method: "POST",
      accept: null,
      actionId: "run",
    });
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
