import { describe, expect, it } from "vitest";

import * as rsc from "../src/index";

describe("rsc exports", () => {
  it("exposes expected entrypoints", () => {
    expect(typeof rsc.rsc).toBe("function");
    expect(typeof rsc.callAction).toBe("function");
    expect(typeof rsc.createFetchTransport).toBe("function");
    expect(typeof rsc.createFunctionTransport).toBe("function");
    expect(typeof rsc.createWorkerTransport).toBe("function");
    expect(typeof rsc.createRSCHandler).toBe("function");
    expect(typeof rsc.createFlightResponse).toBe("function");
  });
});
