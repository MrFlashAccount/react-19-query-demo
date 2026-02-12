import { describe, expect, it } from "vitest";

import { error, html, json, noContent, passthrough, redirect, text } from "./response";

describe("response helpers in browser", () => {
  it("returns typed bodies and headers", async () => {
    const j = json({ ok: true });
    const t = text("hello");
    const h = html("<p>x</p>");

    expect(j.headers.get("content-type")).toContain("application/json");
    expect(t.headers.get("content-type")).toContain("text/plain");
    expect(h.headers.get("content-type")).toContain("text/html");

    await expect(j.json()).resolves.toEqual({ ok: true });
  });

  it("supports redirect/no-content/error", async () => {
    const r = redirect("https://example.com", 307);
    const n = noContent();
    const e = error("boom", 418);

    expect(r.status).toBe(307);
    expect(n.status).toBe(204);
    expect(e.status).toBe(418);
    await expect(e.json()).resolves.toEqual({ error: "boom" });
  });

  it("passthrough delegates to fetch", async () => {
    const request = new Request("https://example.com");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
      expect(input).toBe(request);
      return new Response("ok", { status: 200 });
    };

    const res = await passthrough(request);
    expect(res.status).toBe(200);

    globalThis.fetch = originalFetch;
  });
});
