import { describe, expect, it, vi } from "vitest";

describe("polyfill", () => {
  it("reports not required when controller exists", async () => {
    vi.resetModules();
    (globalThis as Record<string, unknown>).ReadableByteStreamController = class {};

    const mod = await import("./polyfill");

    expect(mod.isPolyfillRequired()).toBe(false);
    await expect(mod.polyfillReady).resolves.toBeUndefined();
  });

  it("reports required when controller missing", async () => {
    vi.resetModules();
    delete (globalThis as Record<string, unknown>).ReadableByteStreamController;

    const mod = await import("./polyfill");

    expect(mod.isPolyfillRequired()).toBe(true);
    await expect(mod.polyfillReady).resolves.toBeUndefined();
  });
});
