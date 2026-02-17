import { describe, expect, it } from "vitest";

import { decodeWireValue, encodeWireValue } from "../src/flight-runtime/wire";

function decodeWithResolver(value: unknown): unknown {
  return decodeWireValue(value, (id) => `client:${id}`);
}

function measureDecodeMs(value: unknown, iterations = 1): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    decodeWithResolver(value);
  }
  return performance.now() - start;
}

describe("flight wire decode correctness", () => {
  it("decodes all supported tagged values", () => {
    const formDataWire = {
      $t: "formdata",
      v: [
        ["name", "demo"],
        ["count", 2],
      ],
    };
    const encodedElement = {
      $t: "element",
      ty: { $t: "host", v: "div" },
      props: { title: "demo", nested: { $t: "undef" } },
      key: "k1",
    };
    const payload = {
      undef: { $t: "undef" },
      bigint: { $t: "bigint", v: "9" },
      date: { $t: "date", v: "2025-01-01T00:00:00.000Z" },
      search: { $t: "search", v: "a=1&b=2" },
      arrayBuffer: encodeWireValue(Uint8Array.from([1, 2, 3]).buffer),
      typed: encodeWireValue(new Uint16Array([4, 5, 6])),
      map: encodeWireValue(
        new Map([
          ["x", 1],
          ["y", 2],
        ]),
      ),
      set: encodeWireValue(new Set(["a", "b"])),
      formdata: formDataWire,
      clientRef: { $t: "clientRef", id: "mod#default" },
      serverRef: { $t: "serverRef", id: "actions#run" },
      element: encodedElement,
    };

    const decoded = decodeWithResolver(payload) as Record<string, unknown>;

    expect(decoded.undef).toBeUndefined();
    expect(decoded.bigint).toBe(9n);
    expect((decoded.date as Date).toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect((decoded.search as URLSearchParams).get("a")).toBe("1");

    expect(new Uint8Array(decoded.arrayBuffer as ArrayBuffer)).toEqual(Uint8Array.from([1, 2, 3]));
    expect(Array.from(decoded.typed as Uint16Array)).toEqual([4, 5, 6]);
    expect(Array.from((decoded.map as Map<string, number>).entries())).toEqual([
      ["x", 1],
      ["y", 2],
    ]);
    expect(Array.from(decoded.set as Set<string>)).toEqual(["a", "b"]);

    const decodedForm = decoded.formdata as FormData;
    expect(decodedForm.get("name")).toBe("demo");
    expect(decodedForm.get("count")).toBe("2");

    expect(decoded.clientRef).toBe("client:mod#default");
    expect(decoded.serverRef).toMatchObject({
      $$typeof: Symbol.for("react.server.reference"),
      $$id: "actions#run",
      $$bound: null,
    });

    const element = decoded.element as {
      type: string;
      props: Record<string, unknown>;
      key: string;
    };
    expect(element.type).toBe("div");
    expect(element.props.title).toBe("demo");
    expect(element.props.nested).toBeUndefined();
    expect(element.key).toBe("k1");
  });
});

describe("flight wire decode perf baselines", () => {
  it("decodes large plain objects within baseline", () => {
    const payload: Record<string, unknown> = {};
    for (let i = 0; i < 4000; i += 1) {
      payload[`k${i}`] = { value: i, list: [i, i + 1, i + 2] };
    }

    const elapsed = measureDecodeMs(payload, 2);
    expect(elapsed).toBeLessThan(5000);
  });

  it("decodes large arrays within baseline", () => {
    const payload = Array.from({ length: 20000 }, (_, i) => ({ n: i, ok: true }));
    const elapsed = measureDecodeMs(payload, 2);
    expect(elapsed).toBeLessThan(5000);
  });

  it("decodes map set and formdata heavy payloads within baseline", () => {
    const map = new Map<string, unknown>();
    const set = new Set<string>();
    const form = new FormData();
    for (let i = 0; i < 2000; i += 1) {
      map.set(`m${i}`, { i });
      set.add(`s${i}`);
      form.append(`f${i}`, String(i));
    }
    const payload = encodeWireValue({ map, set, form });

    const elapsed = measureDecodeMs(payload, 2);
    expect(elapsed).toBeLessThan(6000);
  });

  it("decodes typed and arrayBuffer payloads within baseline", () => {
    const bytes = new Uint8Array(64 * 1024);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = i % 251;
    }
    const payload = encodeWireValue({
      typed: new Uint8Array(bytes),
      arrayBuffer: bytes.buffer,
    });

    const elapsed = measureDecodeMs(payload, 4);
    expect(elapsed).toBeLessThan(4000);
  });
});
