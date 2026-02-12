import { describe, expect, it } from "vitest";

import { moduleCache } from "../src/runtime/webpack-shim";

describe("webpack-shim", () => {
  it("installs webpack globals", () => {
    expect(globalThis.__webpack_module_cache__).toBe(moduleCache);
    expect(typeof globalThis.__webpack_require__).toBe("function");
    expect(typeof globalThis.__webpack_chunk_load__).toBe("function");
    expect(typeof globalThis.__webpack_get_script_filename__).toBe("function");
    expect(globalThis.__webpack_public_path__).toBe("/");
  });

  it("loads modules from cache and throws on missing", () => {
    moduleCache.test = { exports: { ok: 1 } };

    expect(globalThis.__webpack_require__("test")).toEqual({ ok: 1 });
    expect(() => globalThis.__webpack_require__("missing")).toThrow();
  });

  it("supports helper APIs r/d/t", () => {
    const exportsObj: Record<string, unknown> = {};
    globalThis.__webpack_require__.r(exportsObj);

    expect((exportsObj as { __esModule?: boolean }).__esModule).toBe(true);

    globalThis.__webpack_require__.d(exportsObj, {
      value: () => 42,
    });

    expect(exportsObj.value).toBe(42);
    expect(globalThis.__webpack_require__.t({ x: 1 }, 8)).toEqual({ x: 1 });
  });

  it("covers namespace helper branches", () => {
    moduleCache.mod = { exports: { named: "value" } };

    const mode1 = globalThis.__webpack_require__.t("mod", 1);
    expect((mode1 as Record<string, unknown>).default).toEqual({ named: "value" });

    const mode4 = globalThis.__webpack_require__.t({ __esModule: true, x: 1 }, 4);
    expect(mode4).toEqual({ __esModule: true, x: 1 });

    const mode2 = globalThis.__webpack_require__.t({ x: 1 }, 2) as Record<string, unknown>;
    expect(mode2.default).toEqual({ x: 1 });
    expect(mode2.x).toBe(1);
  });

  it("returns async chunk helpers", async () => {
    await expect(globalThis.__webpack_chunk_load__()).resolves.toBeUndefined();
    await expect(globalThis.__webpack_require__.e()).resolves.toBeUndefined();
    expect(globalThis.__webpack_get_script_filename__()).toBe("");
  });
});
