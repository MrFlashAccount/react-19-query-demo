import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

const renderToReadableStream = vi.fn(async () => new ReadableStream<Uint8Array>());
const registerServerReference = vi.fn((fn) => fn);
const createClientModuleProxy = vi.fn((moduleId: string) => ({ __id: moduleId }));
const decodeReply = vi.fn(async (body: unknown) => {
  if (typeof body === "string") {
    return JSON.parse(body);
  }
  if (body instanceof FormData) {
    return Array.from(body.entries()).map(([, value]) => value);
  }
  return [];
});

vi.mock("react-server-dom-webpack/server", () => ({
  renderToReadableStream,
  registerServerReference,
  createClientModuleProxy,
  decodeReply,
}));

import {
  createClientProxy,
  createRSC,
  createRSCContext,
  decodeActionArgs,
  getActionIdFromRequest,
  handleAction,
  isActionRequest,
  registerAction,
  registerActions,
  renderRSC,
} from "../src/server";

describe("rsc server", () => {
  it("creates context", () => {
    const ctx = createRSCContext({});
    expect(ctx.actions.size).toBe(0);
  });

  it("registers actions", async () => {
    const ctx = createRSCContext({});

    await registerAction(ctx, "one", () => 1);
    await registerActions(ctx, {
      two: () => 2,
    });

    expect(ctx.actions.has("one")).toBe(true);
    expect(ctx.actions.has("two")).toBe(true);
  });

  it("creates client proxy", async () => {
    const proxy = await createClientProxy("client");
    expect(proxy).toEqual({ __id: "client" });
  });

  it("renders stream", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = createRSCContext({});
    const stream = await renderRSC(createElement("div", null, "ok"), ctx);

    expect(stream).toBeInstanceOf(ReadableStream);
    expect(renderToReadableStream).toHaveBeenCalled();
    const lastCall = renderToReadableStream.mock.calls.at(-1) as
      | [unknown, unknown, { onError?: (error: unknown) => string }]
      | undefined;
    const onError = lastCall?.[2]?.onError;
    expect(onError?.("boom")).toBe("An error occurred during server rendering.");
    errorSpy.mockRestore();
  });

  it("decodes string and formdata args", async () => {
    const stringArgs = await decodeActionArgs({ type: "string", data: "[1,2]" });
    const formArgs = await decodeActionArgs({ type: "formdata", data: "a=1&b=2" });

    expect(stringArgs).toEqual([1, 2]);
    expect(formArgs).toEqual(["1", "2"]);
  });

  it("handles action lookup and module#name normalization", async () => {
    const ctx = createRSCContext({});
    await registerAction(ctx, "run", async (...args: unknown[]) =>
      createElement("p", null, String(args[0] ?? "")),
    );

    const stream = await handleAction(ctx, "mod#run", { type: "string", data: "[\"ok\"]" });
    expect(stream).toBeInstanceOf(ReadableStream);

    await expect(
      handleAction(ctx, "missing", { type: "string", data: "[]" }),
    ).rejects.toThrow('Action "missing" not found');
  });

  it("extracts action id from headers", () => {
    const one = new Request("https://app.test", { headers: { "rsc-action": "a" } });
    const two = new Request("https://app.test", { headers: { "x-rsc-action": "b" } });
    const none = new Request("https://app.test");

    expect(getActionIdFromRequest(one)).toBe("a");
    expect(getActionIdFromRequest(two)).toBe("b");
    expect(getActionIdFromRequest(none)).toBeNull();
    expect(isActionRequest(two)).toBe(true);
    expect(isActionRequest(none)).toBe(false);
  });

  it("creates full RSC setup", async () => {
    const setup = createRSC<{ Counter: unknown }>({
      moduleId: "client",
      components: ["Counter"],
      actions: {
        inc: (...args: unknown[]) => Number(args[0] ?? 0) + 1,
      },
    });

    expect(setup.ctx.manifest["client#Counter"]?.name).toBe("Counter");
    const client = setup.Client as Record<string, { $$id?: string }>;
    expect(client.Counter.$$id).toBe("client#Counter");
    expect(client.Counter).toBe(client.Counter);

    await expect(setup.ready).resolves.toBeUndefined();
    expect(setup.ctx.actions.has("inc")).toBe(true);
  });

  it("creates RSC setup without actions", async () => {
    const setup = createRSC<{ Counter: unknown }>({
      moduleId: "client",
      components: ["Counter"],
    });

    await expect(setup.ready).resolves.toBeUndefined();
    expect(setup.ctx.actions.size).toBe(0);
  });
});
