import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { encodeReply } from "../src/flight-runtime/client";
import { decodeReply, renderToRowEmitter } from "../src/flight-runtime/server";
import { ROW_BINARY, ROW_DONE, ROW_MODEL } from "../src/flight-runtime/wire";

describe("flight runtime server stream behavior", () => {
  it("returns before server render resolves and emits deferred rows via row emitter", async () => {
    const state: { resolveRendered?: () => void } = {};
    const rendered = new Promise<unknown>((resolve) => {
      state.resolveRendered = () => resolve("ready");
    });

    const rows: { k: number; id?: number; v?: unknown }[] = [];
    const emitPromise = renderToRowEmitter(rendered as any, null, (row) => {
      rows.push(row as (typeof rows)[0]);
    });

    await Promise.resolve();
    const rootRow = rows.find((r) => r.k === ROW_MODEL && r.id === 0);
    expect(rootRow).toBeDefined();
    expect(rootRow?.v).toEqual({ $t: "rowRef", id: 1 });

    const row1BeforeResolve = rows.find((r) => r.k === ROW_MODEL && r.id === 1);
    expect(row1BeforeResolve).toBeUndefined();

    if (state.resolveRendered != null) {
      state.resolveRendered();
    }
    await emitPromise;

    const row1 = rows.find((r) => r.k === ROW_MODEL && r.id === 1);
    expect(row1?.v).toBe("ready");
    expect(rows.some((r) => r.k === ROW_DONE)).toBe(true);
  });

  it("emits binary rows for ArrayBuffer payloads", async () => {
    const bytes = Uint8Array.from([1, 2, 3, 4]);
    const rows: { k: number; id?: number; t?: string; v?: unknown }[] = [];
    await renderToRowEmitter(bytes.buffer as unknown as ReactNode, null, (row) => {
      rows.push(row as (typeof rows)[0]);
    });

    const modelRow = rows.find((r) => r.k === ROW_MODEL && r.id === 0);
    expect(modelRow).toBeDefined();
    expect(modelRow?.v).toEqual({ $t: "rowRef", id: 1 });

    const binaryRow = rows.find((r) => r.k === ROW_BINARY && r.id === 1);
    expect(binaryRow).toBeDefined();
    expect(binaryRow?.t).toBe("A");
    const buf = binaryRow?.v as ArrayBuffer;
    expect(Array.from(new Uint8Array(buf))).toEqual([1, 2, 3, 4]);
    expect(rows.some((r) => r.k === ROW_DONE)).toBe(true);
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

  it("emits model row with clone wire format when using renderToRowEmitter", async () => {
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
      rows.push(row as typeof rows[0]);
    });

    const modelRow = rows.find((r) => r.k === ROW_MODEL && r.id === 0);
    expect(modelRow).toBeDefined();
    const model = modelRow?.v as Record<string, unknown>;
    expect(model?.$t).toBe("element");
    expect((model?.ty as Record<string, unknown>)?.$t).toBe("host");
    expect((model?.props as Record<string, unknown>)?.onClick).toEqual({
      $t: "clientRef",
      id: "mod#Button",
    });
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

    const rows: { k: number }[] = [];
    await renderToRowEmitter(
      root,
      null,
      (row) => rows.push(row as (typeof rows)[0]),
      {
        traceContext: {
          requestId: "server-trace-1",
          source: "server",
        },
      },
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.k === ROW_DONE)).toBe(true);
  });
});
