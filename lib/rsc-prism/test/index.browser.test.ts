import { describe, expect, it } from "vitest";

import * as rsc from "../src/index";

describe("root entrypoint browser workflows", () => {
  it("keeps root exports focused on lightweight types/reference helpers", () => {
    const rootApi = rsc as unknown as Record<string, unknown>;
    expect(rootApi.fetchRSC).toBeUndefined();
    expect(rootApi.callAction).toBeUndefined();
    expect(rootApi.createWorkerRowTransport).toBeUndefined();

    const ref = rsc.clientRef<{ count: number }>("client", "Counter");
    expect(ref.$$id).toBe("client#Counter");
  });
});
