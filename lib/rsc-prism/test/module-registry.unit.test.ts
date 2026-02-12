import { beforeEach, describe, expect, it } from "vitest";

import { moduleCache } from "../src/runtime/webpack-shim";
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
  beforeEach(() => {
    for (const key of Object.keys(moduleCache)) {
      delete moduleCache[key];
    }
  });

  it("registers and resolves client modules", () => {
    const exports = { Counter: () => "counter" };
    registerClientModule("client", exports);

    expect(hasModule("client")).toBe(true);
    expect(getModule("client")).toBe(exports);
  });

  it("registers multiple modules", () => {
    registerClientModules({
      alpha: { one: 1 },
      beta: { two: 2 },
    });

    expect(hasModule("alpha")).toBe(true);
    expect(hasModule("beta")).toBe(true);
  });

  it("throws when requesting an unknown module", () => {
    expect(() => getModule("missing")).toThrow('Module "missing" not registered');
  });

  it("builds manifest from module names and exports", () => {
    const manifest = buildClientManifest("client", ["Counter", "Button"]);
    const fromModule = buildClientManifestFromModule("client", {
      Counter: () => null,
      Button: () => null,
      constant: 1,
    });

    expect(manifest["client#Counter"]).toEqual({ id: "client", chunks: [], name: "Counter" });
    expect(manifest["client#Button"]).toEqual({ id: "client", chunks: [], name: "Button" });
    expect(fromModule["client#Counter"]).toEqual({ id: "client", chunks: [], name: "Counter" });
    expect(fromModule["client#constant"]).toBeUndefined();
  });

  it("merges manifests", () => {
    const first = buildClientManifest("a", ["One"]);
    const second = buildClientManifest("b", ["Two"]);
    const merged = mergeManifests(first, second);

    expect(merged["a#One"]).toEqual({ id: "a", chunks: [], name: "One" });
    expect(merged["b#Two"]).toEqual({ id: "b", chunks: [], name: "Two" });
  });
});
