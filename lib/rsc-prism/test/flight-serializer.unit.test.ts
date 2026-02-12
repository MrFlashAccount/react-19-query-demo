import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

const renderToReadableStream = vi.fn(async () => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('0:{"ok":true}\n'));
      controller.close();
    },
  });
});

const registerServerReference = vi.fn((fn) => fn);

vi.mock("react-server-dom-webpack/server", () => ({
  renderToReadableStream,
  registerServerReference,
}));

import {
  createFlightResponse,
  createServerAction,
  executeServerAction,
  serializeToFlightPayload,
  serializeToFlightStream,
} from "../src/flight-serializer";

const manifest = {
  client: { id: "client", chunks: ["a.js"], name: "*" },
};

describe("flight serializer parity path", () => {
  it("serializes payload through renderToReadableStream", async () => {
    const payload = await serializeToFlightPayload(createElement("div", null, "hello"), manifest);

    expect(payload).toContain('"ok":true');
    expect(renderToReadableStream).toHaveBeenCalledTimes(1);
  });

  it("returns raw stream output", async () => {
    const stream = await serializeToFlightStream(createElement("div", null, "x"), manifest);
    const reader = stream.getReader();
    const first = await reader.read();

    expect(first.done).toBe(false);
    expect(first.value).toBeInstanceOf(Uint8Array);
  });

  it("creates response with stream body and headers", async () => {
    const response = await createFlightResponse(createElement("div", null, "x"), manifest, {
      status: 201,
      headers: { "x-custom": "1" },
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("text/x-component");
    expect(response.headers.get("x-custom")).toBe("1");
  });

  it("registers and executes server actions", async () => {
    createServerAction("inc", async (v: number) => v + 1);

    const okRes = await executeServerAction("inc", [1], manifest);
    expect(okRes.status).toBe(200);

    const missing = await executeServerAction("missing", [], manifest);
    expect(missing.status).toBe(404);
  });
});
