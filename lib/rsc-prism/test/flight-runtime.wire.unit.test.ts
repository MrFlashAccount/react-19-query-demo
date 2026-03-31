import { describe, expect, it, vi } from "vitest";
import { createFromRowEmitter } from "../src/flight-runtime/client";

import {
  applyDirectPathReplacements,
  createLazyChunkWrapper,
  createModelReviver,
  decodeBinaryWireRow,
  decodeWireValue,
  encodeStreamValue,
  encodeWireValue,
  encodeWireValueWithBinaryRows,
  parseModelString,
  pathsToTree,
  REVIVE_PATH_WILDCARD,
  traverseElementTuplesOnly,
} from "../src/flight-runtime/wire";
import { SERVER_REFERENCE_SYMBOL } from "../src/flight-runtime/wire/constants";
const refTable = ["resolvedModDefault", "client:mod#Button"];
function decodeWithResolver(value: unknown): unknown {
  return decodeWireValue(value, (id: number) => refTable[id] ?? `client:${id}`);
}

function measureDecodeMs(value: unknown, iterations = 1): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    decodeWithResolver(value);
  }
  return performance.now() - start;
}

describe("flight wire decode correctness", () => {
  it("encodes and decodes host elements", () => {
    const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
    const element = {
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "div",
      key: null,
      props: { children: "trace me" },
    };

    const encoded = encodeStreamValue(element, {
      seen: new WeakSet<object>(),
      emitBinaryRow: () => 1,
      outlineValue: () => 1,
    });

    const decoded = decodeWireValue(
      {
        $t: "element",
        ty: { $t: "host", v: "div" },
        props: { children: "trace me" },
        key: null,
      },
      (id) => `client:${id}`,
    );

    expect(encoded).toBeDefined();
    expect(decoded).toBeDefined();
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
      clientRef: { $t: "clientRef", id: 0 },
      serverRef: { $t: "serverRef", id: "actions#run" },
      element: encodedElement,
    };

    const decoded = decodeWireValue(
      payload,
      (id: number) => refTable[id] ?? `client:${id}`,
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

    expect(decoded.clientRef).toBe("resolvedModDefault");
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

  it("decodes numeric clientRef id with O(1) ref table lookup", () => {
    const table = ["resolvedComponent"];
    const decoded = decodeWireValue({ $t: "clientRef", id: 0 }, (id: number) => table[id]);
    expect(decoded).toBe("resolvedComponent");
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
      {
        emitBinaryRow: (kind: string, bytes: Uint8Array) => {
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

  it("passes through binary values for postMessage structured clone", () => {
    const payload = { bytes: new Uint8Array([5, 6, 7]) };
    const encoded = encodeWireValue(payload) as Record<string, unknown>;
    expect(encoded.bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(encoded.bytes as Uint8Array)).toEqual([5, 6, 7]);
    const decoded = decodeWireValue(encoded, (id) => `client:${id}`) as {
      bytes: Uint8Array;
    };
    expect(Array.from(decoded.bytes)).toEqual([5, 6, 7]);
  });
});

describe("flight wire compact stream format", () => {
  it("compacts repeated array-index revive paths using wildcard node", () => {
    const tree = pathsToTree([
      ["items", 0, "onClick"],
      ["items", 1, "onClick"],
      ["items", 2, "onClick"],
    ]);

    expect(tree).toEqual([["items", [[REVIVE_PATH_WILDCARD, [["onClick", true]]]]]]);
  });

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

    expect(encoded.undef).toBeUndefined();
    expect(encoded.bigint).toBe(42n);
    expect(encoded.date).toEqual(new Date("2025-01-01T00:00:00.000Z"));
    expect(encoded.search).toBe("$Pa=1&b=2");
    expect(encoded.escaped).toBe("$$root");
    expect(encoded.map).toEqual(new Map([["a", 1]]));
    expect(outlinedRows).toHaveLength(0);
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
    const chunks = new Map<number, unknown>([[1, pendingChunk]]);
    const context = {
      getChunk: (id: number) => chunks.get(id),
      readChunk: (chunk: unknown) => (chunk as { value: unknown }).value,
      createLazyChunkWrapper: (chunk: unknown) =>
        createLazyChunkWrapper(chunk, (payload) => (payload as { value: unknown }).value),
      resolveClientReference: (id: number) => refTable[id] ?? `client:${id}`,
    };

    expect(parseModelString(context, "$$x")).toBe("$x");
    expect(parseModelString(context, "$R0")).toBe("resolvedModDefault");

    const lazy = parseModelString(context, "$1") as { $$typeof: symbol };
    expect(lazy.$$typeof).toBe(Symbol.for("react.lazy"));
  });

  it("creates callable server references that delegate to callServer", async () => {
    const callServer = vi.fn(async (actionId: string, args: unknown[]) => ({
      actionId,
      args,
    }));
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
      resolveClientReference: (id: number) => refTable[id] ?? id,
      callServer,
    };

    const action = parseModelString(context, "$F1") as ((
      ...args: unknown[]
    ) => Promise<unknown>) & {
      $$typeof: symbol;
      $$id: string;
      $$bound: null;
    };

    await expect(action("a", 2)).resolves.toEqual({
      actionId: "actions#save",
      args: ["a", 2],
    });
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
      resolveClientReference: (id: number) => refTable[id] ?? id,
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

  it("collects revive paths during stream encoding and hybrid revival replaces inline $ strings", () => {
    const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
    const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
    const clientRef = {
      $$typeof: CLIENT_REFERENCE_SYMBOL,
      $$id: "mod#Button",
      $$refId: 1,
    };
    const element = {
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "div",
      key: null,
      props: {
        onClick: clientRef,
        children: "hello",
      },
    };

    const revivePaths: (string | number)[][] = [];
    const encoded = encodeStreamValue(element, {
      seen: new WeakSet<object>(),
      emitBinaryRow: () => 1,
      outlineValue: () => 1,
      _path: [],
      pushReviveValue: (_v, path) => revivePaths.push([...path]),
    });

    expect(revivePaths.length).toBeGreaterThan(0);
    expect(revivePaths.some((p) => p[p.length - 1] === "onClick")).toBe(true);

    const context = {
      getChunk: () => null,
      readChunk: () => null,
      createLazyChunkWrapper: () => null,
      resolveClientReference: (id: number) => refTable[id] ?? `client:${id}`,
    };

    const tree = pathsToTree(revivePaths);
    applyDirectPathReplacements(encoded, tree, context);
    const revived = traverseElementTuplesOnly(context, encoded) as {
      type: string;
      props: { onClick: unknown; children: string };
    };

    expect(revived).toBeDefined();
    expect(revived.type).toBe("div");
    expect(revived.props.onClick).toBe("client:mod#Button");
    expect(revived.props.children).toBe("hello");
  });

  it("pushes server ref paths to revivePaths when encoding", () => {
    const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
    const serverRef = {
      $$typeof: SERVER_REFERENCE_SYMBOL,
      $$id: "worker-actions#updateMovieRating",
    };
    const element = {
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "div",
      key: null,
      props: { onUpdateRating: serverRef, children: "hi" },
    };

    const revivePaths: (string | number)[][] = [];
    encodeStreamValue(element, {
      seen: new WeakSet<object>(),
      emitBinaryRow: () => 1,
      outlineValue: () => 1,
      _path: [],
      pushReviveValue: (_v, path) => revivePaths.push([...path]),
    });

    expect(revivePaths.some((p) => p[p.length - 1] === "onUpdateRating")).toBe(true);
  });

  it("applies wildcard revive paths across list children", () => {
    const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
    const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
    const clientRef = {
      $$typeof: CLIENT_REFERENCE_SYMBOL,
      $$id: "mod#Button",
      $$refId: 1,
    };
    const element = {
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "div",
      key: null,
      props: {
        children: [
          {
            $$typeof: REACT_ELEMENT_SYMBOL,
            type: "button",
            key: "a",
            props: { onClick: clientRef, children: "a" },
          },
          {
            $$typeof: REACT_ELEMENT_SYMBOL,
            type: "button",
            key: "b",
            props: { onClick: clientRef, children: "b" },
          },
        ],
      },
    };

    const revivePaths: (string | number)[][] = [];
    const encoded = encodeStreamValue(element, {
      seen: new WeakSet<object>(),
      emitBinaryRow: () => 1,
      outlineValue: () => 1,
      _path: [],
      pushReviveValue: (_v, path) => revivePaths.push([...path]),
    });
    const tree = pathsToTree(revivePaths);
    const context = {
      getChunk: () => null,
      readChunk: () => null,
      createLazyChunkWrapper: () => null,
      resolveClientReference: (id: number) => refTable[id] ?? `client:${id}`,
    };

    applyDirectPathReplacements(encoded, tree, context);
    const revived = traverseElementTuplesOnly(context, encoded) as {
      props: { children: Array<{ props: { onClick: unknown } }> };
    };

    expect(revived.props.children).toHaveLength(2);
    expect(revived.props.children[0].props.onClick).toBe("client:mod#Button");
    expect(revived.props.children[1].props.onClick).toBe("client:mod#Button");
  });

  it("applies flat revive paths directly without tree conversion", () => {
    const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
    const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
    const clientRef = {
      $$typeof: CLIENT_REFERENCE_SYMBOL,
      $$id: "mod#Button",
      $$refId: 1,
    };
    const element = {
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "div",
      key: null,
      props: {
        onClick: clientRef,
        children: "hello",
      },
    };

    const revivePaths: (string | number)[][] = [];
    const encoded = encodeStreamValue(element, {
      seen: new WeakSet<object>(),
      emitBinaryRow: () => 1,
      outlineValue: () => 1,
      _path: [],
      pushReviveValue: (_v, path) => revivePaths.push([...path]),
    });

    expect(revivePaths.length).toBeGreaterThan(0);
    const context = {
      getChunk: () => null,
      readChunk: () => null,
      createLazyChunkWrapper: () => null,
      resolveClientReference: (id: number) => refTable[id] ?? `client:${id}`,
    };

    applyDirectPathReplacements(encoded, revivePaths, context);
    const revived = traverseElementTuplesOnly(context, encoded) as {
      type: string;
      props: { onClick: unknown; children: string };
    };

    expect(revived).toBeDefined();
    expect(revived.type).toBe("div");
    expect(revived.props.onClick).toBe("client:mod#Button");
    expect(revived.props.children).toBe("hello");
  });

  it("expands template metadata before model revival", async () => {
    const emitter = createFromRowEmitter<Array<{ type: string; props: { children: string } }>>();
    emitter.push({
      k: 4,
      id: 0,
      revivePaths: [],
      templates: [
        {
          id: 0,
          shape: ["$", "div", null, { children: { $slot: 0 } }],
        },
      ],
    });
    emitter.push({
      k: 0,
      id: 0,
      v: [
        { $tpl: 0, $v: ["first"] },
        { $tpl: 0, $v: ["second"] },
      ],
    });
    emitter.push({ k: 2 });

    const resolved = await emitter.result;
    expect(Array.isArray(resolved)).toBe(true);
    expect(resolved[0].type).toBe("div");
    expect(resolved[0].props.children).toBe("first");
    expect(resolved[1].props.children).toBe("second");
  });

  it("unwraps plain object {children: x} when used as React child", () => {
    const context = {
      getChunk: () => null,
      readChunk: () => null,
      createLazyChunkWrapper: () => null,
      resolveClientReference: (id: number) => refTable[id] ?? `client:${id}`,
    };
    const encoded = [
      "$",
      "div",
      null,
      {
        children: [
          ["$", "span", null, { children: "first" }],
          { children: [["$", "span", null, { children: "wrapped" }]] },
          ["$", "span", null, { children: "third" }],
        ],
      },
    ];
    const decoded = traverseElementTuplesOnly(context, encoded) as {
      type: string;
      props: { children: unknown[] };
    };
    expect(decoded.props.children).toHaveLength(3);
    expect(decoded.props.children[0]).toMatchObject({
      type: "span",
      props: { children: "first" },
    });
    const second = decoded.props.children[1];
    const secondEl = Array.isArray(second) ? second[0] : second;
    expect(secondEl).toMatchObject({
      type: "span",
      props: { children: "wrapped" },
    });
    expect(decoded.props.children[2]).toMatchObject({
      type: "span",
      props: { children: "third" },
    });
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
    const payload = Array.from({ length: 20000 }, (_, i) => ({
      n: i,
      ok: true,
    }));
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
        (id: number) => refTable[id] ?? `client:${id}`,
        (id) => binaryRows.get(id),
      );
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(4000);
  });
});
