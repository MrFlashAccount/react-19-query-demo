import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const renderToReadableStream = vi.fn(async (model: unknown) => {
    const payload = JSON.stringify(model);
    const encoder = new TextEncoder();
    const chunk = encoder.encode(payload);
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.close();
      },
    });
  });

  const registerServerReference = vi.fn((fn) => fn);
  return { renderToReadableStream, registerServerReference };
});

vi.mock("react-server-dom-webpack/server", () => ({
  default: {},
}));

vi.mock("react-server-dom-webpack/server.browser", () => ({
  renderToReadableStream: mocks.renderToReadableStream,
  registerServerReference: mocks.registerServerReference,
}));

import {
  createFlightResponse,
  createServerAction,
  executeServerAction,
  serializeToFlightPayload,
} from "../../src/rsc/flight-serializer";

const manifest = {
  client: { id: "client", chunks: ["a.js"], name: "*" },
  "client#Counter": { id: "client", chunks: ["a.js"], name: "Counter" },
};

describe("flight serializer", () => {
  it("serializes payloads using server.browser renderer", async () => {
    const payload = await serializeToFlightPayload(
      createElement("div", { ok: true }, "hello"),
      manifest,
    );

    expect(payload).toContain("hello");
    expect(mocks.renderToReadableStream).toHaveBeenCalled();
  });

  it("creates and executes registered server actions", async () => {
    createServerAction("sum", (a: number, b: number) => ({ value: a + b }));
    const response = await executeServerAction("sum", [2, 3], manifest);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"value":5');
    expect(mocks.registerServerReference).toHaveBeenCalled();
  });

  it("returns 404 for unknown action", async () => {
    const response = await executeServerAction("missing", [], manifest);
    expect(response.status).toBe(404);
  });

  it("creates response with x-component content type", async () => {
    const response = await createFlightResponse(createElement("div", null, "x"), manifest);
    expect(response.headers.get("Content-Type")).toContain("text/x-component");
  });
});
