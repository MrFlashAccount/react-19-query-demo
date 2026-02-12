import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  renderRSC: vi.fn(async () => new ReadableStream<Uint8Array>()),
  handleAction: vi.fn(async () => new ReadableStream<Uint8Array>()),
  getActionIdFromRequest: vi.fn((request: Request) => request.headers.get("x-rsc-action")),
  createRSCContext: vi.fn((manifest: Record<string, unknown>) => ({
    manifest,
    actions: new Map(),
  })),
  registerActions: vi.fn(async () => {}),
}));

vi.mock("../src/server", () => ({
  renderRSC: mocks.renderRSC,
  handleAction: mocks.handleAction,
  getActionIdFromRequest: mocks.getActionIdFromRequest,
  createRSCContext: mocks.createRSCContext,
  registerActions: mocks.registerActions,
}));

import { createRSCHandler, rsc, rscAction, rscError, rscWithContext } from "../src/response";

const manifest = {
  client: { id: "client", chunks: [], name: "*" },
};

describe("rsc response helpers", () => {
  it("renders rsc response with default headers", async () => {
    const response = await rsc(createElement("div", null, "ok"), manifest);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/x-component");
    expect(response.headers.get("cache-control")).toContain("no-cache");
  });

  it("renders with provided context", async () => {
    const ctx = { manifest, actions: new Map() };
    const response = await rscWithContext(createElement("div", null, "ok"), ctx, { status: 201 });

    expect(response.status).toBe(201);
    expect(mocks.renderRSC).toHaveBeenCalled();
  });

  it("action returns 400 on missing action id", async () => {
    const response = await rscAction(new Request("https://app.test", { method: "POST" }), {
      manifest,
      actions: new Map(),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing action ID" });
  });

  it("action handles form payload and server errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.handleAction.mockRejectedValueOnce("boom");

    const response = await rscAction(
      new Request("https://app.test", {
        method: "POST",
        headers: { "x-rsc-action": "run", "content-type": "application/x-www-form-urlencoded" },
        body: "x=1",
      }),
      { manifest, actions: new Map() },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "boom" });
    errorSpy.mockRestore();
  });

  it("creates handler and delegates render/action", async () => {
    const handler = createRSCHandler({
      manifest,
      actions: {
        run: () => "ok",
      },
    });

    await expect(handler.ready).resolves.toBeUndefined();

    const renderRes = await handler.render(createElement("div", null, "ok"));
    expect(renderRes.headers.get("content-type")).toBe("text/x-component");

    const actionRes = await handler.action(
      new Request("https://app.test", {
        method: "POST",
        headers: { "x-rsc-action": "run" },
        body: "[]",
      }),
    );

    expect(actionRes.status).toBe(200);
  });

  it("creates error response", async () => {
    const res = rscError("bad", 422);
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ error: "bad" });
  });
});
