import { describe, expect, it } from "vitest";

import { decodeBinaryWireRow, decodeWireValue, encodeWireValue, encodeWireValueWithBinaryRows } from "../src/flight-runtime/wire";

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
    const binaryRows = new Map<string, unknown>([
      ["1", decodeBinaryWireRow("A", Uint8Array.from([1, 2, 3]))],
      ["2", decodeBinaryWireRow("s", new Uint8Array(new Uint16Array([4, 5, 6]).buffer))],
    ]);
    const payload = {
      undef: { $t: "undef" },
      bigint: { $t: "bigint", v: "9" },
      date: { $t: "date", v: "2025-01-01T00:00:00.000Z" },
      search: { $t: "search", v: "a=1&b=2" },
      arrayBuffer: { $t: "rowRef", id: 1 },
      typed: { $t: "rowRef", id: 2 },
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

    const decoded = decodeWireValue(
      payload,
      (id) => `client:${id}`,
      (id) => binaryRows.get(id),
    ) as Record<string, unknown>;

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

  it("encodes typed-array and DataView byte ranges without full-buffer expansion", () => {
    const backing = new ArrayBuffer(16);
    const allBytes = new Uint8Array(backing);
    for (let i = 0; i < allBytes.length; i += 1) {
      allBytes[i] = i;
    }

    const int16View = new Int16Array(backing, 4, 2);
    const dataView = new DataView(backing, 8, 4);
    const binaryRows = new Map<string, unknown>();
    const encoded = encodeWireValueWithBinaryRows(
      { int16View, dataView },
      (kind, bytes) => {
        const id = String(binaryRows.size + 1);
        const tag =
          kind === "Int16Array"
            ? "S"
            : kind === "DataView"
              ? "V"
              : (() => {
                  throw new Error(`Unexpected kind ${kind}`);
                })();
        binaryRows.set(id, decodeBinaryWireRow(tag, bytes));
        return id;
      },
    );
    const decoded = decodeWireValue(
      encoded,
      (id) => `client:${id}`,
      (id) => binaryRows.get(id),
    ) as {
      int16View: Int16Array;
      dataView: DataView;
    };

    expect(Array.from(decoded.int16View)).toEqual(Array.from(int16View));
    expect(decoded.dataView.byteLength).toBe(4);
    expect(Array.from(new Uint8Array(decoded.dataView.buffer))).toEqual([8, 9, 10, 11]);
  });

  it("encodes binary values as row refs when binary row emitter is provided", () => {
    const rows: Array<{ kind: string; bytes: Uint8Array }> = [];
    const encoded = encodeWireValueWithBinaryRows(
      {
        bytes: new Uint8Array([5, 6, 7]),
      },
      (kind, bytes) => {
        rows.push({ kind, bytes });
        return rows.length;
      },
    ) as Record<string, unknown>;

    expect(encoded.bytes).toEqual({ $t: "rowRef", id: 1 });
    expect(rows[0].kind).toBe("Uint8Array");
    expect(Array.from(rows[0].bytes)).toEqual([5, 6, 7]);
    const rowPayload = decodeBinaryWireRow("o", rows[0].bytes);
    const decoded = decodeWireValue(encoded, (id) => `client:${id}`, (id) => (id === "1" ? rowPayload : null)) as {
      bytes: Uint8Array;
    };
    expect(Array.from(decoded.bytes)).toEqual([5, 6, 7]);
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
    const payload = {
      typed: { $t: "rowRef", id: 1 },
      arrayBuffer: { $t: "rowRef", id: 2 },
    };
    const binaryRows = new Map<string, unknown>([
      ["1", decodeBinaryWireRow("o", bytes)],
      ["2", decodeBinaryWireRow("A", bytes)],
    ]);

    const start = performance.now();
    for (let i = 0; i < 4; i += 1) {
      decodeWireValue(
        payload,
        (id) => `client:${id}`,
        (id) => binaryRows.get(id),
      );
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(4000);
  });
});
