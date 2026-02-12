import { describe, expect, it } from "vitest";

import * as rsc from "./index";

describe("rsc exports", () => {
  it("exposes expected entrypoints", () => {
    expect(typeof rsc.rsc).toBe("function");
    expect(typeof rsc.rscGet).toBe("function");
    expect(typeof rsc.callAction).toBe("function");
    expect(typeof rsc.createRSCHandler).toBe("function");
    expect(typeof rsc.createFlightResponse).toBe("function");
  });
});
