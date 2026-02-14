import { describe, expect, it } from "vitest";

import * as clientOnly from "../src/client-only";
import { createFunctionTransport } from "../src/transport";

function flightValueResponse(value: unknown): Response {
  return new Response(`0:${JSON.stringify(value)}\n`, {
    status: 200,
    headers: { "content-type": "text/x-component" },
  });
}

describe("client-only browser workflows", () => {
  it("registers modules and runs fetch/action flows", async () => {
    const moduleId = `client-only-${Date.now()}`;
    clientOnly.registerClientModule(moduleId, {
      Counter: () => null,
    });

    expect(clientOnly.hasModule(moduleId)).toBe(true);
    expect((clientOnly.getModule(moduleId) as { Counter?: unknown } | undefined)?.Counter).toBeDefined();

    const manifest = clientOnly.buildClientManifest(moduleId, ["Counter"]);
    expect(manifest[`${moduleId}#Counter`]?.name).toBe("Counter");

    const transport = createFunctionTransport(async (request) => {
      if (request.method === "GET") {
        return flightValueResponse("fetch-ok");
      }
      return flightValueResponse("action-ok");
    });
    const runActionRef = {
      $$typeof: Symbol.for("react.server.reference"),
      $$id: "todo-actions.ts#run",
      $$bound: null,
    };

    await expect(clientOnly.fetchRSC("/rsc", { transport })).resolves.toBe("fetch-ok");
    await expect(
      clientOnly.callAction<string>(runActionRef, [1], { transport, parseResponse: true }),
    ).resolves.toBe("action-ok");
  });
});
