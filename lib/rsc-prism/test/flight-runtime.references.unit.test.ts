import { describe, expect, it } from "vitest";

import { createClientModuleProxy } from "../src/module-references";

describe("flight runtime references", () => {
  it("memoizes proxy export lookups by export name", () => {
    const proxy = createClientModuleProxy("/src/client-module.tsx");
    const first = proxy.Widget as { $$typeof: symbol; $$id: string };
    const second = proxy.Widget as { $$typeof: symbol; $$id: string };
    const other = proxy.Other as { $$typeof: symbol; $$id: string };

    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first.$$typeof).toBe(Symbol.for("react.client.reference"));
    expect(first.$$id).toBe("/src/client-module.tsx#Widget");
    expect(other.$$id).toBe("/src/client-module.tsx#Other");
  });

  it("preserves esm marker behavior", () => {
    const proxy = createClientModuleProxy("/src/client-module.tsx");
    expect((proxy as { __esModule?: unknown }).__esModule).toBe(true);
  });
});
