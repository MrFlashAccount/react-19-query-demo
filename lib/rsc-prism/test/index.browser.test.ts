import { describe, expect, it } from "vitest";

import * as rsc from "../src/index";
import { createFunctionTransport } from "../src/transport";

function flightValueResponse(value: unknown): Response {
  return new Response(`0:${JSON.stringify(value)}\n`, {
    status: 200,
    headers: { "content-type": "text/x-component" },
  });
}

describe("root entrypoint browser workflows", () => {
  it("runs client-safe fetch/action workflows via root exports", async () => {
    const transport = createFunctionTransport(async (request) => {
      if (request.method === "GET") {
        return flightValueResponse("root-fetch");
      }
      return flightValueResponse("root-action");
    });

    await expect(rsc.fetchRSC<string>("/rsc", { transport })).resolves.toBe("root-fetch");
    await expect(
      rsc.callAction<string>("/rsc", "run", [], { transport, parseResponse: true }),
    ).resolves.toBe("root-action");

    const ref = rsc.clientRef<{ count: number }>("client", "Counter");
    expect(ref.$$id).toBe("client#Counter");
  });
});
