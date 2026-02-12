import { createElement, Fragment } from "react";
import { describe, expect, it } from "vitest";

import {
  createFlightResponse,
  createServerAction,
  executeServerAction,
  getServerAction,
  serializeToFlightPayload,
  serializeToFlightStream,
} from "../src/flight-serializer";
import { clientRef } from "../src/client-reference";

const manifest = {
  client: { id: "client", chunks: [], name: "*" },
  "client#Counter": { id: "client", chunks: [], name: "Counter" },
};

describe("flight serializer in browser", () => {
  it("serializes intrinsic, fragment, and client refs", async () => {
    const Counter = clientRef<{ count: number }>("client", "Counter");
    const intrinsic = await serializeToFlightPayload(createElement("div", null, "hello"), manifest);
    const clientPayload = await serializeToFlightPayload(
      createElement(Counter, { count: 1 }),
      manifest,
    );
    const fragmentPayload = await serializeToFlightPayload(
      createElement(Fragment, null, createElement("span", null, "frag")),
      manifest,
    );

    expect(intrinsic).toContain("0:");
    expect(clientPayload).toContain("I[");
    expect(clientPayload).toContain("$L");
    expect(fragmentPayload).toContain("0:null");
  });

  it("supports async server components", async () => {
    const AsyncComponent = async () => createElement("span", null, "done");
    const payload = await serializeToFlightPayload(createElement(AsyncComponent), manifest);

    expect(payload).toContain("done");
  });

  it("registers and executes server actions", async () => {
    createServerAction("inc", async (v: number) => createElement("p", null, String(v + 1)));

    expect(getServerAction("inc")).toBeTypeOf("function");

    const okRes = await executeServerAction("inc", [1], manifest);
    expect(okRes.status).toBe(200);
    await expect(okRes.text()).resolves.toContain("2");

    const notFound = await executeServerAction("missing", [], manifest);
    expect(notFound.status).toBe(404);

    createServerAction("boom", () => {
      throw new Error("boom");
    });
    const failed = await executeServerAction("boom", [], manifest);
    expect(failed.status).toBe(500);
  });

  it("creates stream and response with expected headers", async () => {
    const stream = await serializeToFlightStream(createElement("div", null, "x"), manifest);
    const reader = stream.getReader();
    const first = await reader.read();

    expect(first.done).toBe(false);
    expect(first.value).toBeInstanceOf(Uint8Array);

    const response = await createFlightResponse(createElement("div", null, "x"), manifest, {
      status: 201,
      headers: { "x-custom": "1" },
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("text/x-component");
    expect(response.headers.get("x-custom")).toBe("1");
  });
});
