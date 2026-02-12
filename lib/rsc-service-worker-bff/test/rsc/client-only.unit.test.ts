import { describe, expect, it } from "vitest";

import * as clientOnly from "../../src/rsc/client-only";

describe("client-only exports", () => {
  it("exposes client-safe helpers", () => {
    expect(typeof clientOnly.fetchRSC).toBe("function");
    expect(typeof clientOnly.callAction).toBe("function");
    expect(typeof clientOnly.registerClientModule).toBe("function");
    expect(typeof clientOnly.isPolyfillRequired).toBe("function");
  });
});
