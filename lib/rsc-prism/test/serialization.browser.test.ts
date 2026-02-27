import { describe, expect, it } from "vitest";

import { encodeActionArgs } from "../src/client";

describe("RSC serialization conformance", () => {
  it("encodes supported serializable argument types", async () => {
    const formData = new FormData();
    formData.append("name", "demo");

    const payload = [
      "x",
      1,
      true,
      null,
      undefined,
      2n,
      new Date("2025-01-01T00:00:00.000Z"),
      [1, { deep: "ok" }],
      new Map<string, unknown>([
        ["a", 1],
        ["b", { nested: true }],
      ]),
      new Set(["x", "y"]),
      new Uint8Array([1, 2, 3]),
      Uint8Array.from([9, 8]).buffer,
      formData,
      { plain: { object: 1 } },
    ];

    const encoded = await encodeActionArgs(payload);
    expect(encoded.type).toBe("object");
    expect(encoded.data).toBeTruthy();
  });

  it("rejects non-serializable class instances", async () => {
    class CustomValue {
      constructor(public readonly value: number) {}
    }

    await expect(encodeActionArgs([new CustomValue(1)])).rejects.toThrow();
  });

  it("rejects symbols without temporary reference support", async () => {
    await expect(encodeActionArgs([Symbol.for("rsc.prism.test")])).rejects.toThrow();
  });
});
