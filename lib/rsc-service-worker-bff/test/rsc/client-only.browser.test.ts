import { describe, expect, it } from "vitest";

import * as clientOnly from "../../src/rsc/client-only";
import { createMockWorkerTransport } from "../utils/mock-worker-transport";

function flightValueResponse(value: unknown): Response {
  return new Response(`0:${JSON.stringify(value)}\n`, {
    status: 200,
    headers: { "content-type": "text/x-component" },
  });
}

describe("client-only browser entrypoint", () => {
  it("registers modules and runs fetch/action workflows", async () => {
    const moduleId = `client-only-${Date.now()}`;
    clientOnly.registerClientModule(moduleId, {
      Counter: () => null,
    });

    expect(clientOnly.hasModule(moduleId)).toBe(true);
    expect(clientOnly.getModule(moduleId)?.Counter).toBeDefined();

    const manifest = clientOnly.buildClientManifest(moduleId, ["Counter"]);
    expect(manifest[`${moduleId}#Counter`]?.name).toBe("Counter");

    const transport = createMockWorkerTransport(async (request) => {
      if (request.operation === "fetch") {
        return flightValueResponse("fetch-ok");
      }
      return flightValueResponse("action-ok");
    });

    await expect(
      clientOnly.fetchRSC<string>("/rsc", { transport, waitForReady: false }),
    ).resolves.toBe("fetch-ok");
    await expect(
      clientOnly.callAction<string>("/rsc", "run", [1], {
        transport,
        parseResponse: true,
        waitForReady: false,
      }),
    ).resolves.toBe("action-ok");
  });
});
