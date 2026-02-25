import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { encodeReply } from "../src/flight-runtime/client";
import { decodeReply, renderToReadableStream } from "../src/flight-runtime/server";
import { TraceRecorder } from "./utils/trace-recorder";

describe("flight runtime server stream behavior", () => {
  it("returns stream before server render resolves and emits deferred rows", async () => {
    const state: { resolveRendered?: () => void } = {};
    const rendered = new Promise<unknown>((resolve) => {
      state.resolveRendered = () => resolve("ready");
    });

    const streamPromise = renderToReadableStream(rendered as any, {});
    const raced = await Promise.race([
      streamPromise.then(() => "resolved"),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 20)),
    ]);
    expect(raced).toBe("resolved");

    const stream = await streamPromise;
    const reader = stream.getReader();
    const first = await reader.read();
    const secondPending = reader.read();

    const pendingState = await Promise.race([
      secondPending.then(() => "resolved"),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 20)),
    ]);
    expect(pendingState).toBe("pending");

    if (state.resolveRendered != null) {
      state.resolveRendered();
    }
    const second = await secondPending;
    const third = await reader.read();

    const row0 = new TextDecoder().decode(first.value);
    const row1 = new TextDecoder().decode(second.value);
    expect(row0).toBe(`0:${JSON.stringify("$1")}\n`);
    expect(row1).toBe(`1:${JSON.stringify("ready")}\n`);
    expect(third.done).toBe(true);
  });

  it("emits binary rows for ArrayBuffer payloads", async () => {
    const bytes = Uint8Array.from([1, 2, 3, 4]);
    const stream = await renderToReadableStream(bytes.buffer as unknown as ReactNode, {});
    const reader = stream.getReader();
    const rows: Uint8Array[] = [];
    while (true) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      rows.push(next.value);
    }

    const fullText = rows.map((r) => new TextDecoder().decode(r)).join("");
    const expectedBinary = new Uint8Array([49, 58, 65, 52, 44, 1, 2, 3, 4, 10]); // "1:A4," + bytes + "\n"
    expect(
      fullText.includes(`0:"$1"`) || fullText.includes(`0:{"__r":0}`),
    ).toBe(true);
    expect(
      rows.some(
        (row) =>
          row.length === expectedBinary.length && row.every((b, i) => b === expectedBinary[i]),
      ),
    ).toBe(true);
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

  it("emits metadata row M{id} before model row when payload has revive paths", async () => {
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

    const stream = await renderToReadableStream(root, {});
    const reader = stream.getReader();
    const chunks: string[] = [];
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      chunks.push(new TextDecoder().decode(next.value));
    }

    const fullText = chunks.join("");
    expect(fullText).toMatch(/M0:\{"revivePaths":\[/);
    expect(fullText).toContain(`0:["$","div",null,`);
  });

  it("emits component render/encode spans with host tag coverage and durations", async () => {
    const traceRecorder = new TraceRecorder();
    traceRecorder.start();
    try {
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

      const stream = await renderToReadableStream(
        root,
        {},
        {
          traceContext: {
            requestId: "server-trace-1",
            source: "server",
          },
        },
      );
      await new Response(stream).text();

      const renderSpans = traceRecorder.getSpansByName("rsc.component.render");
      const encodeSpans = traceRecorder.getSpansByName("rsc.component.encode");
      expect(renderSpans.length).toBeGreaterThan(0);
      expect(encodeSpans.length).toBeGreaterThan(0);
      expect(
        encodeSpans.some(
          (span) => span.payload.componentKind === "host" && span.payload.hostTag === "span",
        ),
      ).toBe(true);
      expect([...renderSpans, ...encodeSpans].every((span) => (span.duration ?? -1) >= 0)).toBe(
        true,
      );
    } finally {
      traceRecorder.stop();
    }
  });
});
