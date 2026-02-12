import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { createServerAction, serializeToFlightPayload } from "../../src/rsc/flight-serializer";

const manifest = {
  client: { id: "client", chunks: ["a.js"], name: "*" },
  "client#Counter": { id: "client", chunks: ["a.js"], name: "Counter" },
};

describe("flight serializer branch coverage", () => {
  it("serializes promises, arrays, and regular objects", async () => {
    const payload = await serializeToFlightPayload(
      Promise.resolve({
        ok: true,
        list: [1, "x", null],
      }) as unknown as any,
      manifest,
    );

    expect(payload).toContain('"ok":true');
    expect(payload).toContain('"list"');
  });

  it("serializes server references as objects and functions", async () => {
    const actionSymbol = Symbol.for("react.server.reference");

    const byObject = await serializeToFlightPayload(
      {
        $$typeof: actionSymbol,
        $$id: "actionByObject",
      } as unknown as any,
      manifest,
    );

    const fn = (() => "ok") as (() => string) & { $$typeof?: symbol; $$id?: string };
    fn.$$typeof = actionSymbol;
    fn.$$id = "actionByFunction";
    const byFunction = await serializeToFlightPayload(fn as unknown as any, manifest);

    expect(byObject).toContain("$F");
    expect(byFunction).toContain("$F");
  });

  it("serializes client references with fallback module resolution", async () => {
    const clientSymbol = Symbol.for("react.client.reference");
    const payload = await serializeToFlightPayload(
      {
        $$typeof: clientSymbol,
        $$id: "client",
        name: "*",
      } as unknown as any,
      manifest,
    );

    expect(payload).toContain("I[");
    expect(payload).toContain("$L");
  });

  it("serializes function client reference element and caches module/action refs", async () => {
    const clientSymbol = Symbol.for("react.client.reference");
    const type = (function CounterRef() {
      return null;
    }) as (() => null) & {
      $$typeof?: symbol;
      $$id?: string;
      name?: string;
    };
    type.$$typeof = clientSymbol;
    type.$$id = "client#Counter";

    const increment = createServerAction("inc-cache", (n: number) => n + 1) as unknown as (
      value: number,
    ) => number;

    const payload = await serializeToFlightPayload(
      createElement("div", {
        first: createElement(type as unknown as string, { count: 1 }),
        second: createElement(type as unknown as string, { count: 2 }),
        one: increment,
        two: increment,
      }),
      manifest,
    );

    const imports = payload.match(/:I\[/g) ?? [];
    expect(imports.length).toBe(1);
    const actionRows = payload.match(/\{"id":"inc-cache","bound":null\}/g) ?? [];
    expect(actionRows.length).toBe(1);
  });

  it("serializes server component function return", async () => {
    function ServerComponent() {
      return createElement("span", null, "server");
    }

    const payload = await serializeToFlightPayload(createElement(ServerComponent), manifest);
    expect(payload).toContain("server");
  });

  it("serializes root function values and fragment children", async () => {
    const rootFunction = await serializeToFlightPayload((() => "ok") as unknown as any, manifest);
    const fragmentElement = {
      $$typeof: Symbol.for("react.transitional.element"),
      type: Symbol.for("react.fragment"),
      key: null,
      props: { children: "inside" },
    };
    const fragment = await serializeToFlightPayload(
      fragmentElement as unknown as any,
      manifest,
    );
    const unsupported = await serializeToFlightPayload(Symbol("x") as unknown as any, manifest);

    expect(rootFunction).toContain("ok");
    expect(fragment).toContain("0:null");
    expect(unsupported).toContain("0:null");
  });
});
