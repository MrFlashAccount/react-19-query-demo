import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { http } from "./http";
import { createWorker, setupWorker } from "./worker";

type ListenerMap = Record<string, ((event: any) => void)[]>;

describe("worker", () => {
  const listeners: ListenerMap = {};

  const fakeSelf = {
    addEventListener: vi.fn((type: string, cb: (event: any) => void) => {
      listeners[type] ||= [];
      listeners[type]!.push(cb);
    }),
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  };

  const originalSelf = (globalThis as Record<string, unknown>).self;
  const originalURLPattern = (globalThis as Record<string, unknown>).URLPattern;

  class URLPatternStub {
    private readonly parts: string[];

    constructor(init?: { pathname?: string } | string) {
      const path = typeof init === "string" ? init : (init?.pathname ?? "/");
      this.parts = path.split("/").filter(Boolean);
    }

    exec(input?: { pathname?: string } | string) {
      const pathname = typeof input === "string" ? input : (input?.pathname ?? "/");
      const inputParts = pathname.split("/").filter(Boolean);

      if (this.parts.length !== inputParts.length) return null;

      const groups: Record<string, string | undefined> = {};
      for (let i = 0; i < this.parts.length; i += 1) {
        const expected = this.parts[i]!;
        const actual = inputParts[i]!;
        if (expected.startsWith(":")) {
          groups[expected.slice(1)] = actual;
          continue;
        }
        if (expected !== actual) return null;
      }

      return { pathname: { groups } };
    }
  }

  beforeEach(() => {
    for (const key of Object.keys(listeners)) {
      delete listeners[key];
    }
    (globalThis as Record<string, unknown>).self = fakeSelf;
    (globalThis as Record<string, unknown>).URLPattern = URLPatternStub;
    vi.clearAllMocks();
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).self = originalSelf;
    (globalThis as Record<string, unknown>).URLPattern = originalURLPattern;
  });

  it("registers listeners and dispatches matched fetch", async () => {
    const route = http.get("/api/:id", ({ params }) => Response.json({ id: params.id }));
    setupWorker([route]);

    const fetchCb = listeners.fetch?.[0];
    expect(fetchCb).toBeTypeOf("function");

    let result: Response | undefined;
    fetchCb?.({
      request: new Request("https://app.test/api/42", { method: "GET" }),
      respondWith: (value: Promise<Response>) => {
        void value.then((res) => {
          result = res;
        });
      },
    });

    await vi.waitFor(() => expect(result).toBeDefined());
    await expect(result!.json()).resolves.toEqual({ id: "42" });
  });

  it("uses fallback for unmatched routes", async () => {
    setupWorker([], {
      fallback: () => new Response("fallback", { status: 202 }),
    });

    const fetchCb = listeners.fetch?.[0];
    let response: Response | undefined;

    fetchCb?.({
      request: new Request("https://app.test/nope", { method: "GET" }),
      respondWith: (value: Promise<Response>) => {
        void value.then((res) => {
          response = res;
        });
      },
    });

    await vi.waitFor(() => expect(response).toBeDefined());
    expect(response!.status).toBe(202);
  });

  it("respects basePath", async () => {
    const fallback = vi.fn(() => new Response("no"));
    setupWorker([], { basePath: "/api", fallback });

    const fetchCb = listeners.fetch?.[0];
    fetchCb?.({
      request: new Request("https://app.test/other", { method: "GET" }),
      respondWith: vi.fn(),
    });

    expect(fallback).not.toHaveBeenCalled();
  });

  it("does not respond when unmatched and no fallback", () => {
    setupWorker([]);
    const respondWith = vi.fn();
    const fetchCb = listeners.fetch?.[0];

    fetchCb?.({
      request: new Request("https://app.test/nope", { method: "GET" }),
      respondWith,
    });

    expect(respondWith).not.toHaveBeenCalled();
  });

  it("returns standardized error when route handler throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = http.get("/boom", () => {
      throw new Error("broken");
    });
    setupWorker([route]);

    let result: Response | undefined;
    const fetchCb = listeners.fetch?.[0];
    fetchCb?.({
      request: new Request("https://app.test/boom", { method: "GET" }),
      respondWith: (value: Promise<Response>) => {
        void value.then((res) => {
          result = res;
        });
      },
    });

    await vi.waitFor(() => expect(result).toBeDefined());
    expect(result?.status).toBe(500);
    await expect(result!.json()).resolves.toEqual({ error: "broken" });
    errorSpy.mockRestore();
  });

  it("handles install and activate lifecycle events", async () => {
    setupWorker([]);

    const installCb = listeners.install?.[0];
    const activateCb = listeners.activate?.[0];
    const waitUntil = vi.fn();

    installCb?.({ waitUntil });
    activateCb?.({ waitUntil });

    expect(fakeSelf.skipWaiting).toHaveBeenCalled();
    expect(fakeSelf.clients.claim).toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalledTimes(2);
  });

  it("createWorker start/stop lifecycle", async () => {
    const unregister = vi.fn(async () => true);
    const sw = new EventTarget() as EventTarget & { state: string };
    sw.state = "installing";

    const registration = {
      installing: sw,
      waiting: null,
      active: null,
      unregister,
    } as unknown as ServiceWorkerRegistration;

    const register = vi.fn(async () => registration);
    const nav = {
      serviceWorker: {
        register,
      },
    };

    const originalNavigator = (globalThis as Record<string, unknown>).navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: nav,
      configurable: true,
      writable: true,
    });

    const worker = createWorker("/sw.js");
    const startPromise = worker.start();

    await Promise.resolve();
    sw.state = "activated";
    sw.dispatchEvent(new Event("statechange"));

    const reg = await startPromise;
    expect(reg).toBe(registration);

    await worker.stop();
    expect(unregister).toHaveBeenCalled();

    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it("createWorker throws when service workers unsupported", async () => {
    const originalNavigator = (globalThis as Record<string, unknown>).navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });

    const worker = createWorker("/sw.js");
    await expect(worker.start()).rejects.toThrow("Service Workers are not supported in this browser");

    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it("createWorker start resolves immediately when already active", async () => {
    const registration = {
      installing: null,
      waiting: null,
      active: { state: "activated" },
      unregister: vi.fn(async () => true),
    } as unknown as ServiceWorkerRegistration;
    const register = vi.fn(async () => registration);

    const originalNavigator = (globalThis as Record<string, unknown>).navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: { serviceWorker: { register } },
      configurable: true,
      writable: true,
    });

    const worker = createWorker("/sw.js");
    await expect(worker.start()).resolves.toBe(registration);
    await expect(worker.stop()).resolves.toBeUndefined();

    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it("createWorker stop is a no-op before start", async () => {
    const worker = createWorker("/sw.js");
    await expect(worker.stop()).resolves.toBeUndefined();
  });
});
