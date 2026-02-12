import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-server-dom-webpack/client", () => ({
  createFromReadableStream: vi.fn(async () => ({ tree: "ok" })),
  encodeReply: vi.fn(async (args: unknown[]) => JSON.stringify(args)),
}));

import {
  callAction,
  consumeRSC,
  consumeRSCResponse,
  createCallServer,
  encodeActionArgs,
  fetchRSC,
} from "../src/client";
import { createFetchTransport } from "../src/transport";

describe("rsc client", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("encodeActionArgs encodes to string", async () => {
    const encoded = await encodeActionArgs([1, "x"]);

    expect(encoded.type).toBe("string");
    expect(encoded.data).toContain("1");
  });

  it("encodeActionArgs handles formdata payloads", async () => {
    const mod = await import("react-server-dom-webpack/client");
    const form = new FormData();
    form.append("x", "1");
    vi.mocked(mod.encodeReply).mockResolvedValueOnce(form as unknown as string);

    const encoded = await encodeActionArgs([1]);

    expect(encoded.type).toBe("formdata");
    expect(encoded.data).toContain("x=1");
  });

  it("consumeRSCResponse errors on empty body", async () => {
    const response = new Response(null);
    await expect(consumeRSCResponse(response)).rejects.toThrow("Response has no body");
  });

  it("consumeRSCResponse forwards body and options", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x"));
        controller.close();
      },
    });
    const response = new Response(stream);

    await expect(
      consumeRSCResponse(response, {
        callServer: async () => "ok",
      }),
    ).resolves.toEqual({ tree: "ok" });
  });

  it("consumeRSC delegates to client reader", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x"));
        controller.close();
      },
    });

    await expect(consumeRSC(stream)).resolves.toEqual({ tree: "ok" });
  });

  it("createCallServer posts action and consumes response", async () => {
    globalThis.fetch = vi.fn(async () => new Response("payload", { status: 200 })) as typeof fetch;

    const callServer = createCallServer("/rsc/action");
    const result = await callServer("inc", [1]);

    expect(result).toEqual({ tree: "ok" });
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("createCallServer throws on non-ok response", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 400 })) as typeof fetch;
    const callServer = createCallServer("/rsc/action");

    await expect(callServer("inc", [1])).rejects.toThrow("Action request failed: 400");
  });

  it("fetchRSC adds accept header and parses body", async () => {
    globalThis.fetch = vi.fn(async (_input, init) => {
      expect(new Headers(init?.headers).get("accept")).toBe("text/x-component");
      return new Response("payload", { status: 200 });
    }) as typeof fetch;

    await expect(fetchRSC("/rsc")).resolves.toEqual({ tree: "ok" });
  });

  it("fetchRSC throws on non-ok status", async () => {
    globalThis.fetch = vi.fn(async () => new Response("no", { status: 502 })) as typeof fetch;
    await expect(fetchRSC("/rsc")).rejects.toThrow("RSC fetch failed: 502");
  });

  it("callAction throws on non-ok and parses when requested", async () => {
    globalThis.fetch = vi.fn(async () => new Response("fail", { status: 500 })) as typeof fetch;
    await expect(callAction("/rsc", "run", [])).rejects.toThrow("Action 'run' failed: 500");

    globalThis.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as typeof fetch;
    await expect(callAction("/rsc", "run", [], { parseResponse: true })).resolves.toEqual({ tree: "ok" });
  });

  it("callAction returns undefined when parseResponse disabled or body missing", async () => {
    globalThis.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as typeof fetch;
    await expect(callAction("/rsc", "run", [])).resolves.toBeUndefined();

    globalThis.fetch = vi.fn(async () => new Response(null, { status: 204 })) as typeof fetch;
    await expect(callAction("/rsc", "run", [], { parseResponse: true })).resolves.toBeUndefined();
  });

  it("supports custom transport for fetch and action", async () => {
    const transport = createFetchTransport();
    const fetchRSCSpy = vi.fn(async () => new Response("payload", { status: 200 }));
    const sendActionSpy = vi.fn(async () => new Response("payload", { status: 200 }));
    transport.fetchRSC = fetchRSCSpy;
    transport.sendAction = sendActionSpy;

    await expect(fetchRSC("/rsc", { transport })).resolves.toEqual({ tree: "ok" });
    await expect(callAction("/rsc", "run", [1], { parseResponse: true, transport })).resolves.toEqual({
      tree: "ok",
    });

    expect(fetchRSCSpy).toHaveBeenCalled();
    expect(sendActionSpy).toHaveBeenCalled();
  });
});
