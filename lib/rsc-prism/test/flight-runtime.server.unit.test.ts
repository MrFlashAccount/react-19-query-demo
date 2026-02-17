import { describe, expect, it } from "vitest";

import { renderToReadableStream } from "../src/flight-runtime/server";

describe("flight runtime server stream behavior", () => {
  it("returns stream before server render resolves and emits deferred rows", async () => {
    let resolveRendered: ((value: unknown) => void) | null = null;
    const rendered = new Promise<unknown>((resolve) => {
      resolveRendered = resolve;
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

    resolveRendered?.("ready");
    const second = await secondPending;
    const third = await reader.read();

    const row0 = new TextDecoder().decode(first.value);
    const row1 = new TextDecoder().decode(second.value);
    expect(row0).toBe(`0:${JSON.stringify({ $t: "rowRef", id: 1 })}\n`);
    expect(row1).toBe(`1:${JSON.stringify("ready")}\n`);
    expect(third.done).toBe(true);
  });
});
