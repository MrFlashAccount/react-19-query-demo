import { describe, expect, it } from "vitest";

import { clientRef, createClientModule, createClientRefs } from "../src/client-reference";

const refIdMap = new Map([
  ["client#Counter", 0],
  ["client#Button", 1],
  ["client#default", 2],
]);

describe("client-reference", () => {
  it("creates single ref", () => {
    const counterRef = clientRef<{ count: number }>("client", "Counter", 0);

    expect(counterRef.$$id).toBe("client#Counter");
    expect(counterRef.$$refId).toBe(0);
    expect(counterRef.$$typeof).toBe(Symbol.for("react.client.reference"));
  });

  it("creates refs map", () => {
    const refs = createClientRefs<{ Counter: (p: { count: number }) => null; Button: () => null }>(
      "client",
      ["Counter", "Button"],
      refIdMap,
    );

    expect(refs.Counter.$$id).toBe("client#Counter");
    expect(refs.Counter.$$refId).toBe(0);
    expect(refs.Button.$$id).toBe("client#Button");
    expect(refs.Button.$$refId).toBe(1);
  });

  it("creates manifest with refs", () => {
    const { manifest, refs } = createClientModule<{ Counter: (p: { count: number }) => null }>(
      "client",
      ["Counter"],
      refIdMap,
    );

    expect(manifest).toEqual("/");
    expect(refs.Counter.$$id).toBe("client#Counter");
    expect(refs.Counter.$$refId).toBe(0);
  });
});
