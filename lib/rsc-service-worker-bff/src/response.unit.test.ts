import { describe, expect, it, vi } from "vitest";

import { error, html, json, noContent, passthrough, redirect, text } from "./response";

describe("response helpers", () => {
  it("creates JSON responses with content-type", async () => {
    const response = json({ ok: true }, { status: 201 });

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("creates text and html responses with expected headers", async () => {
    const textResponse = text("hello");
    const htmlResponse = html("<h1>hi</h1>");

    expect(textResponse.headers.get("content-type")).toContain("text/plain");
    expect(htmlResponse.headers.get("content-type")).toContain("text/html");
    await expect(textResponse.text()).resolves.toBe("hello");
    await expect(htmlResponse.text()).resolves.toBe("<h1>hi</h1>");
  });

  it("creates no-content and error responses", async () => {
    const empty = noContent();
    const failed = error("boom", 422);

    expect(empty.status).toBe(204);
    expect(failed.status).toBe(422);
    await expect(failed.json()).resolves.toEqual({ error: "boom" });
  });

  it("uses default redirect and error status", async () => {
    const moved = redirect("https://example.com");
    const failed = error("default");

    expect(moved.status).toBe(302);
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({ error: "default" });
  });

  it("passes through request via fetch", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));

    const request = new Request("https://example.com/api", { method: "GET" });
    const result = await passthrough(request);

    expect(fetchSpy).toHaveBeenCalledWith(request);
    expect(result.status).toBe(200);
    fetchSpy.mockRestore();
  });
});
