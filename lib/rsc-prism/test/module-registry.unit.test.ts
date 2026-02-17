import { describe, expect, it } from "vitest";
import {
  buildClientManifest,
  buildClientManifestFromModule,
  getModule,
  hasModule,
  mergeManifests,
  registerClientModule,
  registerClientModules,
} from "../src/runtime/module-registry";

describe("module registry", () => {
  it("accepts module registration as a no-op in ESM mode", () => {
    registerClientModule("/src/client.tsx", { Counter: () => "counter" });
    expect(hasModule("/src/client.tsx")).toBe(true);
  });

  it("accepts multi registration as a no-op in ESM mode", () => {
    registerClientModules({
      alpha: { one: 1 },
      beta: { two: 2 },
    });

    expect(hasModule("alpha")).toBe(true);
    expect(hasModule("beta")).toBe(true);
  });

  it("throws when requesting sync module resolution in ESM mode", () => {
    expect(() => getModule("missing")).toThrow("cannot be synchronously resolved in ESM mode");
  });

  it("builds manifest base URL from module ids", () => {
    const manifest = buildClientManifest("client", ["Counter", "Button"]);
    const fromModule = buildClientManifestFromModule("client", {
      Counter: () => null,
      Button: () => null,
      constant: 1,
    });

    expect(manifest).toBe("/");
    expect(fromModule).toBe("/");
  });

  it("returns last non-empty manifest in merge", () => {
    const first = "/a/";
    const second = "/b/";
    const merged = mergeManifests(first, second);

    expect(merged).toBe("/b/");
  });
});
