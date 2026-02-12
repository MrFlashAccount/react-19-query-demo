import { describe, expect, it } from "vitest";

import * as pkg from "../src/index";

describe("root exports", () => {
  it("exposes core api", () => {
    expect(typeof pkg.http.get).toBe("function");
    expect(typeof pkg.setupWorker).toBe("function");
    expect(typeof pkg.createWorker).toBe("function");
    expect(typeof pkg.createRSCHandler).toBe("function");
    expect(typeof pkg.createFlightResponse).toBe("function");
  });
});
