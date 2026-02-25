import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { compileRoute, matchRoute } from "../src/router";

class URLPatternStub {
  private readonly parts: string[];

  constructor(init?: { pathname?: string } | string) {
    const path = typeof init === "string" ? init : (init?.pathname ?? "/");
    this.parts = path.split("/").filter(Boolean);
  }

  exec(input?: { pathname?: string } | string) {
    const pathname = typeof input === "string" ? input : (input?.pathname ?? "/");
    const inputParts = pathname.split("/").filter(Boolean);

    if (this.parts.length !== inputParts.length) {
      return null;
    }

    const groups: Record<string, string | undefined> = {};
    for (let i = 0; i < this.parts.length; i += 1) {
      const expected = this.parts[i]!;
      const actual = inputParts[i]!;
      if (expected.startsWith(":")) {
        groups[expected.slice(1)] = actual;
        continue;
      }
      if (expected !== actual) {
        return null;
      }
    }

    return { pathname: { groups } };
  }
}

describe("router", () => {
  const original = (globalThis as Record<string, unknown>).URLPattern;

  beforeAll(() => {
    (globalThis as Record<string, unknown>).URLPattern = URLPatternStub;
  });

  afterAll(() => {
    (globalThis as Record<string, unknown>).URLPattern = original;
  });

  it("compiles a route", () => {
    const handler = () => new Response("ok");
    const compiled = compileRoute({ method: "GET", path: "/users/:id", handler });

    expect(compiled.method).toBe("GET");
    expect(compiled.handler).toBe(handler);
  });

  it("matches route and decodes params", () => {
    const compiled = [
      compileRoute({ method: "GET", path: "/users/:id", handler: () => new Response() }),
    ];

    const match = matchRoute("/users/alice%20smith", "GET", compiled);

    expect(match?.params).toEqual({ id: "alice smith" });
  });

  it("returns null for non matching method or path", () => {
    const compiled = [
      compileRoute({ method: "POST", path: "/users/:id", handler: () => new Response() }),
    ];

    expect(matchRoute("/users/1", "GET", compiled)).toBeNull();
    expect(matchRoute("/teams/1", "POST", compiled)).toBeNull();
  });
});
