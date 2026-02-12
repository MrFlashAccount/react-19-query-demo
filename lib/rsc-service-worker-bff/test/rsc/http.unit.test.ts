import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { createRSCRoutes, rscGet, rscPost, rscRoutes } from "../../src/rsc/http";

describe("rsc http", () => {
  it("builds rsc get and post routes", async () => {
    const handler = {
      ready: Promise.resolve(),
      ctx: { manifest: {}, actions: new Map() },
      render: vi.fn(async () => new Response("rendered", { status: 200 })),
      action: vi.fn(async () => new Response("action", { status: 200 })),
    };

    const get = rscGet("/rsc", handler as any, async () => createElement("div", null, "ok"));
    const post = rscPost("/rsc", handler as any);

    const getRes = await get.handler({
      request: new Request("https://app.test/rsc"),
      url: new URL("https://app.test/rsc"),
      params: {},
    });

    const postRes = await post.handler({
      request: new Request("https://app.test/rsc", { method: "POST" }),
      url: new URL("https://app.test/rsc"),
      params: {},
    });

    expect(getRes.status).toBe(200);
    expect(postRes.status).toBe(200);
    expect(handler.render).toHaveBeenCalled();
    expect(handler.action).toHaveBeenCalled();
  });

  it("creates paired routes and composed factory", () => {
    const handler = {
      ready: Promise.resolve(),
      ctx: { manifest: {}, actions: new Map() },
      render: vi.fn(async () => new Response("rendered", { status: 200 })),
      action: vi.fn(async () => new Response("action", { status: 200 })),
    };

    const pair = rscRoutes("/rsc", handler as any, async () => null);
    expect(pair).toHaveLength(2);
    expect(pair[0]?.method).toBe("GET");
    expect(pair[1]?.method).toBe("POST");

    const setup = createRSCRoutes({
      path: "/rsc",
      render: async () => null,
      options: { manifest: {} },
    });

    expect(setup.routes).toHaveLength(2);
    expect(setup.handler.ready).toBeInstanceOf(Promise);
  });
});
