import { describe, expect, it } from "vitest";

import { clientRef, createClientModule, createClientRefs } from "../src/client-reference";

describe("client-reference", () => {
  it("creates single ref", () => {
    const counterRef = clientRef<{ count: number }>("client", "Counter");

    expect(counterRef.$$id).toBe("client#Counter");
    expect(counterRef.$$typeof).toBe(Symbol.for("react.client.reference"));
    expect(counterRef).toBe(counterRef);
  });

  it("creates refs map", () => {
    const refs = createClientRefs<{ Counter: (p: { count: number }) => null; Button: () => null }>(
      "client",
      ["Counter", "Button"],
    );

    expect(refs.Counter.$$id).toBe("client#Counter");
    expect(refs.Button.$$id).toBe("client#Button");
  });

  it("creates manifest with refs", () => {
    const { manifest, refs } = createClientModule<{ Counter: (p: { count: number }) => null }>(
      "client",
      ["Counter"],
    );

    expect(manifest).toEqual("/");
    expect(refs.Counter.$$id).toBe("client#Counter");
  });
});
