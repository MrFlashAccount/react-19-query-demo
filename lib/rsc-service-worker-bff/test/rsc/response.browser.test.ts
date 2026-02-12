import { describe, expect, it } from "vitest";

import { rscAction, rscError } from "../../src/rsc/response";

describe("rsc response browser edge cases", () => {
  it("returns 400 when action id is missing", async () => {
    const response = await rscAction(new Request("https://app.test/rsc", { method: "POST" }), {
      manifest: {},
      actions: new Map(),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing action ID" });
  });

  it("creates json error response", async () => {
    const response = rscError("broken", 503);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "broken" });
  });
});
