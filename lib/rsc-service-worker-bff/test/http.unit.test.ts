import { describe, expect, it, vi } from "vitest";

import { http } from "../src/http";
import type { RSCContext } from "../src/rsc/types";

vi.mock("../src/rsc/server", () => ({
  renderRSC: vi.fn(async () => new ReadableStream<Uint8Array>()),
  handleAction: vi.fn(async () => new ReadableStream<Uint8Array>()),
  isActionRequest: vi.fn((request: Request) => request.headers.has("x-rsc-action")),
  getActionIdFromRequest: vi.fn((request: Request) => request.headers.get("x-rsc-action")),
}));

describe("http rsc helpers", () => {
  const ctx: RSCContext = { manifest: {}, actions: new Map() };

  it("creates rsc route and merges headers", async () => {
    const route = http.rsc(
      "/rsc",
      async () => "hello",
      ctx,
      { ready: Promise.resolve(), headers: { "x-extra": "1" } },
    );

    const res = await route.handler({
      request: new Request("https://app.test/rsc"),
      url: new URL("https://app.test/rsc"),
      params: {},
    });

    expect(route.method).toBe("GET");
    expect(res.headers.get("content-type")).toContain("text/x-component");
    expect(res.headers.get("x-extra")).toBe("1");
  });

  it("creates rsc route without options", async () => {
    const route = http.rsc("/rsc", async () => "hello", ctx);

    const res = await route.handler({
      request: new Request("https://app.test/rsc"),
      url: new URL("https://app.test/rsc"),
      params: {},
    });

    expect(res.headers.get("content-type")).toContain("text/x-component");
  });

  it("action route returns 400 if action header missing", async () => {
    const route = http.action("/rsc", ctx);

    const res = await route.handler({
      request: new Request("https://app.test/rsc", { method: "POST", body: "[]" }),
      url: new URL("https://app.test/rsc"),
      params: {},
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Missing action header (x-rsc-action)" });
  });

  it("action route parses scalar and handles errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handleAction } = await import("../src/rsc/server");
    vi.mocked(handleAction).mockRejectedValueOnce(new Error("action-fail"));

    const route = http.action("/rsc", ctx);

    const res = await route.handler({
      request: new Request("https://app.test/rsc", {
        method: "POST",
        headers: { "x-rsc-action": "m#run" },
        body: "\"hello\"",
      }),
      url: new URL("https://app.test/rsc"),
      params: {},
    });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "action-fail" });
    errorSpy.mockRestore();
  });

  it("action route awaits ready and handles non-json bodies", async () => {
    const { handleAction } = await import("../src/rsc/server");
    vi.mocked(handleAction).mockResolvedValueOnce(new ReadableStream<Uint8Array>());
    const ready = vi.fn(async () => {});

    const route = http.action("/rsc", ctx, {
      ready: ready(),
      headers: { "x-extra": "1" },
    });

    const res = await route.handler({
      request: new Request("https://app.test/rsc", {
        method: "POST",
        headers: { "x-rsc-action": "run" },
        body: "plain-body",
      }),
      url: new URL("https://app.test/rsc"),
      params: {},
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("x-extra")).toBe("1");
    expect(handleAction).toHaveBeenCalledWith(
      ctx,
      "run",
      { type: "string", data: JSON.stringify(["plain-body"]) },
    );
  });

  it("action route handles scalar json and non-error throw", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handleAction } = await import("../src/rsc/server");
    vi.mocked(handleAction).mockRejectedValueOnce("plain-failure");

    const route = http.action("/rsc", ctx);
    const res = await route.handler({
      request: new Request("https://app.test/rsc", {
        method: "POST",
        headers: { "x-rsc-action": "run" },
        body: "1",
      }),
      url: new URL("https://app.test/rsc"),
      params: {},
    });

    expect(handleAction).toHaveBeenCalledWith(ctx, "run", { type: "string", data: "[1]" });
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "plain-failure" });
    errorSpy.mockRestore();
  });

  it("creates paired rsc routes", () => {
    const [getRoute, postRoute] = http.rscRoutes("/rsc", () => null, ctx);
    expect(getRoute.method).toBe("GET");
    expect(postRoute.method).toBe("POST");
  });
});
