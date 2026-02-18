import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { encodeReply } from "../src/flight-runtime/client";
import { decodeReply, renderToReadableStream } from "../src/flight-runtime/server";

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

    const rootRowText = `0:${JSON.stringify("$1")}\n`;
    const expectedBinary = new Uint8Array([49, 58, 65, 52, 44, 1, 2, 3, 4, 10]); // "1:A4," + bytes + "\n"
    expect(rows.some((row) => new TextDecoder().decode(row) === rootRowText)).toBe(true);
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
});
