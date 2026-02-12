import { describe, expect, it } from "vitest";

import { clientRef, createClientModule, createClientRefs } from "../../src/rsc/client-reference";

describe("client-reference", () => {
  it("creates single ref", () => {
    const Counter = clientRef<{ count: number }>("client", "Counter");

    expect(Counter.$$id).toBe("client#Counter");
    expect(Counter.$$typeof).toBe(Symbol.for("react.client.reference"));
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

    expect(manifest.client).toEqual({ id: "client", chunks: [], name: "*" });
    expect(manifest["client#Counter"]).toEqual({ id: "client", chunks: [], name: "Counter" });
    expect(refs.Counter.$$id).toBe("client#Counter");
  });
});
