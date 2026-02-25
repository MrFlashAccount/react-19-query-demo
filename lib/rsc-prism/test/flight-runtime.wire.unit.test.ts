import { describe, expect, it, vi } from "vitest";

import {
  createLazyChunkWrapper,
  createModelReviver,
  decodeBinaryWireRow,
  decodeWireValue,
  encodeStreamValue,
  encodeWireValue,
  encodeWireValueWithBinaryRows,
  parseModelString,
} from "../src/flight-runtime/wire";
import { TraceRecorder } from "./utils/trace-recorder";

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
  it("emits component encode/decode spans with non-negative durations", () => {
    const traceRecorder = new TraceRecorder();
    traceRecorder.start();
    try {
      const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
      const element = {
        $$typeof: REACT_ELEMENT_SYMBOL,
        type: "div",
        key: null,
        props: { children: "trace me" },
      };

      encodeStreamValue(element, {
        seen: new WeakSet<object>(),
        emitBinaryRow: () => 1,
        outlineValue: () => 1,
        traceContext: {
          requestId: "wire-trace-1",
          source: "transport",
        },
      });

      decodeWireValue(
        {
          $t: "element",
          ty: { $t: "host", v: "div" },
          props: { children: "trace me" },
          key: null,
        },
        (id) => `client:${id}`,
        undefined,
        undefined,
        {
          traceContext: {
            requestId: "wire-trace-1",
            source: "react",
          },
        },
      );

      const encodeSpans = traceRecorder.getSpansByName("rsc.component.encode");
      const decodeSpans = traceRecorder.getSpansByName("rsc.component.decode");
      expect(encodeSpans.length).toBeGreaterThan(0);
      expect(decodeSpans.length).toBeGreaterThan(0);
      expect(
        encodeSpans.some(
          (span) => span.payload.componentKind === "host" && span.payload.hostTag === "div",
        ),
      ).toBe(true);
      expect(
        decodeSpans.some(
          (span) => span.payload.componentKind === "host" && span.payload.hostTag === "div",
        ),
      ).toBe(true);
      expect([...encodeSpans, ...decodeSpans].every((span) => (span.duration ?? -1) >= 0)).toBe(
        true,
      );
    } finally {
      traceRecorder.stop();
    }
  });

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
    expect(typeof decoded.serverRef).toBe("function");
    const serverRef = decoded.serverRef as {
      $$typeof: symbol;
      $$id: string;
      $$bound: null;
    };
    expect(serverRef.$$typeof).toBe(Symbol.for("react.server.reference"));
    expect(serverRef.$$id).toBe("actions#run");
    expect(serverRef.$$bound).toBeNull();

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
    const encoded = encodeWireValueWithBinaryRows({ int16View, dataView }, (kind, bytes) => {
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
    });
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
    const decoded = decodeWireValue(
      encoded,
      (id) => `client:${id}`,
      (id) => (id === "1" ? rowPayload : null),
    ) as {
      bytes: Uint8Array;
    };
    expect(Array.from(decoded.bytes)).toEqual([5, 6, 7]);
  });
});

describe("flight wire compact stream format", () => {
  it("encodes compact stream tags for primitive wrappers", () => {
    const outlinedRows: unknown[] = [];
    const encoded = encodeStreamValue(
      {
        undef: undefined,
        bigint: 42n,
        date: new Date("2025-01-01T00:00:00.000Z"),
        search: new URLSearchParams("a=1&b=2"),
        escaped: "$root",
        map: new Map([["a", 1]]),
      },
      {
        seen: new WeakSet<object>(),
        emitBinaryRow: () => 9,
        outlineValue: (value) => {
          outlinedRows.push(value);
          return outlinedRows.length;
        },
      },
    ) as Record<string, unknown>;

    expect(encoded.undef).toBe("$undefined");
    expect(encoded.bigint).toBe("$n42");
    expect(encoded.date).toBe("$D2025-01-01T00:00:00.000Z");
    expect(encoded.search).toBe("$Pa=1&b=2");
    expect(encoded.escaped).toBe("$$root");
    expect(encoded.map).toBe("$Q1");
    expect(outlinedRows).toHaveLength(1);
  });

  it("parses compact stream strings and creates lazy wrappers for unresolved chunks", () => {
    const pendingChunk = {
      status: 0,
      value: null,
      reason: null,
      listeners: null,
      rejectListeners: null,
      then() {},
    };
    const initializedChunk = {
      status: 2,
      value: [["k", 1]],
      reason: null,
      listeners: null,
      rejectListeners: null,
      then() {},
    };
    const chunks = new Map<number, unknown>([
      [1, pendingChunk],
      [2, initializedChunk],
    ]);
    const context = {
      getChunk: (id: number) => chunks.get(id),
      readChunk: (chunk: unknown) => (chunk as { value: unknown }).value,
      createLazyChunkWrapper: (chunk: unknown) =>
        createLazyChunkWrapper(chunk, (payload) => (payload as { value: unknown }).value),
      resolveClientReference: (id: string) => `client:${id}`,
    };

    expect(parseModelString(context, "$$x")).toBe("$x");
    expect(parseModelString(context, "$n9")).toBe(9n);
    expect(parseModelString(context, "$Cmod#default")).toBe("client:mod#default");

    const map = parseModelString(context, "$Q2") as Map<string, number>;
    expect(Array.from(map.entries())).toEqual([["k", 1]]);

    const lazy = parseModelString(context, "$1") as { $$typeof: symbol };
    expect(lazy.$$typeof).toBe(Symbol.for("react.lazy"));
  });

  it("creates callable server references that delegate to callServer", async () => {
    const callServer = vi.fn(async (actionId: string, args: unknown[]) => ({ actionId, args }));
    const serverRefChunk = {
      status: 2,
      value: { id: "actions#save" },
      reason: null,
      listeners: null,
      rejectListeners: null,
      then() {},
    };
    const chunks = new Map<number, unknown>([[1, serverRefChunk]]);
    const context = {
      getChunk: (id: number) => chunks.get(id),
      readChunk: (chunk: unknown) => (chunk as { value: unknown }).value,
      createLazyChunkWrapper: () => null,
      resolveClientReference: (id: string) => id,
      callServer,
    };

    const action = parseModelString(context, "$F1") as ((
      ...args: unknown[]
    ) => Promise<unknown>) & {
      $$typeof: symbol;
      $$id: string;
      $$bound: null;
    };

    await expect(action("a", 2)).resolves.toEqual({ actionId: "actions#save", args: ["a", 2] });
    expect(callServer).toHaveBeenCalledWith("actions#save", ["a", 2]);
    expect(action.$$typeof).toBe(Symbol.for("react.server.reference"));
    expect(action.$$id).toBe("actions#save");
    expect(action.$$bound).toBeNull();
  });

  it("reviver converts element tuples to React elements", () => {
    const reviver = createModelReviver({
      getChunk: (_id: number) => null,
      readChunk: () => null,
      createLazyChunkWrapper: () => null,
      resolveClientReference: (id: string) => id,
    });

    const parsed = JSON.parse(`["$","div",null,{"children":"ok"}]`, reviver) as {
      $$typeof: symbol;
      type: string;
      key: string | null;
      props: { children: string };
    };

    expect(parsed.$$typeof).toBe(Symbol.for("react.transitional.element"));
    expect(parsed.type).toBe("div");
    expect(parsed.key).toBeNull();
    expect(parsed.props.children).toBe("ok");
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
