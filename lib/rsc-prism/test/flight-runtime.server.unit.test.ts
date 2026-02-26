import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { encodeReply, decodeReply } from "../src/actions";
import { renderToRowEmitter } from "../src/flight-runtime/server";
import { ROW_BINARY, ROW_DONE, ROW_METADATA, ROW_MODEL } from "../src/flight-runtime/wire";
import type { FlightRowMessage } from "../src/flight-runtime/wire";

describe("flight runtime server row emitter behavior", () => {
  it("emits deferred rows and resolves", async () => {
    const state: { resolveRendered?: () => void } = {};
    const rendered = new Promise<unknown>((resolve) => {
      state.resolveRendered = () => resolve("ready");
    });

    const rows: FlightRowMessage[] = [];
    const renderPromise = renderToRowEmitter(rendered as ReactNode, null, (row) => rows.push(row));
    queueMicrotask(() => state.resolveRendered?.());
    await renderPromise;

    const modelRows = rows.filter((r) => r.k === ROW_MODEL) as {
      k: number;
      id: number;
      v: unknown;
    }[];
    expect(modelRows.some((r) => r.id === 0 && r.v === "$1")).toBe(true);
    expect(modelRows.some((r) => r.id === 1 && r.v === "ready")).toBe(true);
    expect(rows.some((r) => r.k === ROW_DONE)).toBe(true);
  });

  it("emits binary rows for ArrayBuffer payloads", async () => {
    const bytes = Uint8Array.from([1, 2, 3, 4]);
    const rows: FlightRowMessage[] = [];
    await renderToRowEmitter(bytes.buffer as unknown as ReactNode, null, (row) => rows.push(row));

    const modelRows = rows.filter((r) => r.k === ROW_MODEL);
    const binaryRows = rows.filter((r) => r.k === ROW_BINARY) as {
      k: number;
      id: number;
      t: string;
      v: ArrayBuffer;
    }[];
    expect(modelRows.length).toBeGreaterThan(0);
    expect(binaryRows.length).toBeGreaterThan(0);
    const binaryPayload = binaryRows.find((r) => r.t === "A");
    expect(binaryPayload).toBeDefined();
    expect(Array.from(new Uint8Array(binaryPayload!.v))).toEqual([1, 2, 3, 4]);
  });

  it("round-trips action/reply binary payloads without base64", async () => {
    const payload = {
      typed: new Uint16Array([100, 200, 300]),
      buf: Uint8Array.from([1, 2, 3]).buffer,
    };
    const encoded = await encodeReply(payload);
    expect(encoded instanceof FormData).toBe(true);
    const decoded = (await decodeReply(encoded as FormData, {})) as {
      typed: Uint16Array;
      buf: ArrayBuffer;
    };
    expect(Array.from(decoded.typed)).toEqual([100, 200, 300]);
    expect(Array.from(new Uint8Array(decoded.buf))).toEqual([1, 2, 3]);
  });

  it("emits metadata row before model row when payload has revive paths", async () => {
    const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
    const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
    const clientRef = {
      $$typeof: CLIENT_REFERENCE_SYMBOL,
      $$id: "mod#Button",
    };
    const root = {
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "div",
      key: null,
      props: { onClick: clientRef, children: "hi" },
    } as ReactNode;

    const rows: FlightRowMessage[] = [];
    await renderToRowEmitter(root, null, (row) => rows.push(row));

    const metadataRow = rows.find((r) => r.k === ROW_METADATA && r.id === 0) as {
      revivePaths?: unknown[];
    };
    expect(metadataRow).toBeDefined();
    expect(Array.isArray(metadataRow?.revivePaths)).toBe(true);
    const modelRow = rows.find((r) => r.k === ROW_MODEL && r.id === 0);
    expect(modelRow).toBeDefined();
    expect(JSON.stringify((modelRow as { v: unknown }).v)).toContain('"$","div"');
  });

  it("emits metadata row before model row when using renderToRowEmitter", async () => {
    const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
    const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
    const clientRef = {
      $$typeof: CLIENT_REFERENCE_SYMBOL,
      $$id: "mod#Button",
    };
    const root = {
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "div",
      key: null,
      props: { onClick: clientRef, children: "hi" },
    } as ReactNode;

    const rows: { k: number; id?: number; revivePaths?: unknown; v?: unknown }[] = [];
    await renderToRowEmitter(root, null, (row) => {
      rows.push(row as (typeof rows)[0]);
    });

    const metadataRow = rows.find((r) => r.k === ROW_METADATA);
    const modelRow = rows.find((r) => r.k === ROW_MODEL && r.id === 0);
    expect(metadataRow).toBeDefined();
    expect(metadataRow?.id).toBe(0);
    expect(Array.isArray(metadataRow?.revivePaths)).toBe(true);
    expect((metadataRow?.revivePaths as unknown[]).length).toBeGreaterThan(0);
    expect((metadataRow?.revivePaths as [string, unknown][])[0]).toHaveLength(2);
    expect(modelRow).toBeDefined();
    const metadataIdx = rows.indexOf(metadataRow!);
    const modelIdx = rows.indexOf(modelRow!);
    expect(metadataIdx).toBeLessThan(modelIdx);
  });

  it("skips template metadata in fast mode (default)", async () => {
    const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
    const items = Array.from({ length: 10 }, (_, i) => ({
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "div",
      key: String(i),
      props: {
        className:
          "group bg-white border border-gray-100 rounded-4xl [corner-shape:superellipse(1.33)] overflow-hidden hover:border-black hover:shadow-lg",
        children: [
          {
            $$typeof: REACT_ELEMENT_SYMBOL,
            type: "h3",
            key: null,
            props: {
              className:
                "text-sm sm:text-base font-bold text-black line-clamp-2 sm:truncate group-hover:text-gray-900",
              children: `item-${i}`,
            },
          },
          {
            $$typeof: REACT_ELEMENT_SYMBOL,
            type: "span",
            key: null,
            props: { className: "text-xs text-gray-500", children: "static-label" },
          },
        ],
      },
    })) as ReactNode[];
    const root = {
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "section",
      key: null,
      props: { children: items },
    } as ReactNode;

    const rows: {
      k: number;
      id?: number;
      revivePaths?: unknown;
      templates?: unknown;
      v?: unknown;
    }[] = [];
    await renderToRowEmitter(root, null, (row) => {
      rows.push(row as (typeof rows)[0]);
    });

    const modelRow = rows.find((r) => r.k === ROW_MODEL && r.id === 0);
    expect(modelRow).toBeDefined();
    const json = JSON.stringify(modelRow?.v);
    expect(json).not.toContain('"$tpl":');
  });

  it("skips template metadata for small repeated payloads", async () => {
    const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
    const items = Array.from({ length: 3 }, (_, i) => ({
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "div",
      key: String(i),
      props: { className: "item", children: `item-${i}` },
    })) as ReactNode[];
    const root = {
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "section",
      key: null,
      props: { children: items },
    } as ReactNode;

    const rows: {
      k: number;
      id?: number;
      revivePaths?: unknown;
      templates?: unknown;
      v?: unknown;
    }[] = [];
    await renderToRowEmitter(root, null, (row) => {
      rows.push(row as (typeof rows)[0]);
    });

    const metadataRow = rows.find((r) => r.k === ROW_METADATA && r.id === 0);
    expect(metadataRow).toBeUndefined();
    const modelRow = rows.find((r) => r.k === ROW_MODEL && r.id === 0);
    expect(modelRow).toBeDefined();
    const json = JSON.stringify(modelRow?.v);
    expect(json).not.toContain('"$tpl":');
  });

  it("compacts dominant repeated sub-shapes in mixed arrays", async () => {
    const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
    const repeated = Array.from({ length: 12 }, (_, i) => ({
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "div",
      key: `r-${i}`,
      props: {
        className:
          "group bg-white border border-gray-100 rounded-4xl [corner-shape:superellipse(1.33)] overflow-hidden hover:border-black hover:shadow-lg",
        children: [
          {
            $$typeof: REACT_ELEMENT_SYMBOL,
            type: "h3",
            key: null,
            props: {
              className:
                "text-sm sm:text-base font-bold text-black line-clamp-2 sm:truncate group-hover:text-gray-900",
              children: `repeat-${i}`,
            },
          },
          {
            $$typeof: REACT_ELEMENT_SYMBOL,
            type: "span",
            key: null,
            props: { className: "text-xs text-gray-500", children: "static-label" },
          },
        ],
      },
    })) as ReactNode[];
    const variants = Array.from({ length: 8 }, (_, i) => ({
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "div",
      key: `v-${i}`,
      props: {
        className:
          "group bg-white border border-gray-100 rounded-4xl [corner-shape:superellipse(1.33)] overflow-hidden hover:border-black hover:shadow-lg",
        children: [
          {
            $$typeof: REACT_ELEMENT_SYMBOL,
            type: "h3",
            key: null,
            props: { className: "text-sm font-bold", children: `variant-${i}` },
          },
        ],
      },
    })) as ReactNode[];
    const items = [...repeated, ...variants];
    const root = {
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: "section",
      key: null,
      props: { children: items },
    } as ReactNode;

    const rows: {
      k: number;
      id?: number;
      revivePaths?: unknown;
      templates?: unknown;
      v?: unknown;
    }[] = [];
    await renderToRowEmitter(root, null, (row) => {
      rows.push(row as (typeof rows)[0]);
    }, { fastMode: false });

    const metadataRow = rows.find((r) => r.k === ROW_METADATA && r.id === 0);
    expect(metadataRow).toBeDefined();
    expect(Array.isArray(metadataRow?.templates)).toBe(true);
    expect((metadataRow?.templates as unknown[]).length).toBeGreaterThan(0);

    const modelRow = rows.find((r) => r.k === ROW_MODEL && r.id === 0);
    expect(modelRow).toBeDefined();
    const json = JSON.stringify(modelRow?.v);
    expect(json).toContain('"$tpl":');
  });

  it("renders with trace context", async () => {
    const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
    const Child = () =>
      ({
        $$typeof: REACT_ELEMENT_SYMBOL,
        type: "span",
        key: null,
        props: { children: "ok" },
      }) as ReactNode;
    const root = {
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: Child,
      key: null,
      props: {},
    } as ReactNode;

    const rows: FlightRowMessage[] = [];
    await renderToRowEmitter(root, null, (row) => rows.push(row), {});
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.k === ROW_DONE)).toBe(true);
  });
});
