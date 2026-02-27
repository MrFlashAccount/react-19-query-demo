import { describe, it } from "vitest";

import { encodeReply, decodeReply } from "../../src/actions";

function readEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

function buildLargeBinaryReplyPayload(itemCount: number, itemBytes: number): unknown {
  const rows: Array<{
    id: number;
    bytes: Uint8Array;
    int32: Int32Array;
    f64: Float64Array;
    raw: ArrayBuffer;
  }> = [];
  for (let i = 0; i < itemCount; i += 1) {
    const bytes = new Uint8Array(itemBytes);
    for (let j = 0; j < bytes.length; j += 1) {
      bytes[j] = (i + j * 13) & 255;
    }
    const int32 = new Int32Array(Math.max(8, Math.floor(itemBytes / 4)));
    const f64 = new Float64Array(Math.max(4, Math.floor(itemBytes / 8)));
    for (let j = 0; j < int32.length; j += 1) {
      int32[j] = i + j * 17;
    }
    for (let j = 0; j < f64.length; j += 1) {
      f64[j] = i * 1.1 + j * 3.3;
    }
    rows.push({
      id: i,
      bytes,
      int32,
      f64,
      raw: bytes.buffer.slice(0),
    });
  }
  return {
    rows,
    meta: {
      itemCount,
      itemBytes,
      stamp: "server-decode-reply-perf",
    },
  };
}

async function benchmarkDecodeReply(iterations: number, body: unknown): Promise<{ avgMs: number }> {
  for (let i = 0; i < 2; i += 1) {
    await decodeReply(body, null, undefined);
  }
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    const decoded = await decodeReply(body, null, undefined);
    if (decoded == null || typeof decoded !== "object") {
      throw new Error("Unexpected decodeReply perf result.");
    }
  }
  return { avgMs: (performance.now() - start) / iterations };
}

const perfIt = process.env.RSC_PERF === "1" ? it : it.skip;

describe("flight runtime server decodeReply perf", () => {
  perfIt("prints decodeReply timing for large binary payload", async () => {
    const iterations = readEnvNumber("RSC_PERF_ITERATIONS", 12);
    const itemCount = readEnvNumber("RSC_PERF_SERVER_ITEM_COUNT", 1400);
    const itemBytes = readEnvNumber("RSC_PERF_SERVER_ITEM_BYTES", 256);
    const payload = buildLargeBinaryReplyPayload(itemCount, itemBytes);
    const body = await encodeReply(payload);
    const stats = await benchmarkDecodeReply(iterations, body);
    console.log(
      `\n[rsc-prism perf] iterations=${iterations} items=${itemCount} itemBytes=${itemBytes}`,
    );
    console.log(`[rsc-prism perf] server-decodeReply avg=${formatMs(stats.avgMs)}`);
  });
});
