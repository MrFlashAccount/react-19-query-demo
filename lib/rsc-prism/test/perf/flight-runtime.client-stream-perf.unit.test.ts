import { describe, it } from "vitest";

import { createFromReadableStream } from "../../src/flight-runtime/client";

type FlightPerfStats = {
  rootScanCount: number;
  rootScanTimeMs: number;
  decodeCount: number;
  decodeTimeMs: number;
};

const PERF_KEY = "__rscPrismFlightPerf";

function readEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

function createStats(): FlightPerfStats {
  return {
    rootScanCount: 0,
    rootScanTimeMs: 0,
    decodeCount: 0,
    decodeTimeMs: 0,
  };
}

function buildFlightPayload(rowCount: number): string {
  const refs = new Array(rowCount);
  for (let i = 0; i < rowCount; i += 1) {
    refs[i] = { $t: "rowRef", id: i + 1 };
  }
  let text = `0:${JSON.stringify(refs)}\n`;
  for (let i = 0; i < rowCount; i += 1) {
    text += `${i + 1}:${JSON.stringify({ i, text: `v${i}` })}\n`;
  }
  return text;
}

function toChunkedStream(payload: string, chunkSize: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(payload);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize));
      }
      controller.close();
    },
  });
}

async function benchmark(
  iterations: number,
  payload: string,
  chunkSize: number,
): Promise<{
  avgTotalMs: number;
  avgRootScanCount: number;
  avgRootScanMs: number;
  avgDecodeMs: number;
}> {
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;

  for (let i = 0; i < 2; i += 1) {
    globalState[PERF_KEY] = createStats();
    await createFromReadableStream(toChunkedStream(payload, chunkSize));
  }

  let totalMs = 0;
  let totalRootScanCount = 0;
  let totalRootScanMs = 0;
  let totalDecodeMs = 0;
  for (let i = 0; i < iterations; i += 1) {
    const stats = createStats();
    globalState[PERF_KEY] = stats;
    const start = performance.now();
    const result = (await createFromReadableStream(toChunkedStream(payload, chunkSize))) as unknown[];
    totalMs += performance.now() - start;
    totalRootScanCount += stats.rootScanCount;
    totalRootScanMs += stats.rootScanTimeMs;
    totalDecodeMs += stats.decodeTimeMs;
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Unexpected decode result in perf harness.");
    }
  }
  delete globalState[PERF_KEY];

  return {
    avgTotalMs: totalMs / iterations,
    avgRootScanCount: totalRootScanCount / iterations,
    avgRootScanMs: totalRootScanMs / iterations,
    avgDecodeMs: totalDecodeMs / iterations,
  };
}

const perfIt = process.env.RSC_PERF === "1" ? it : it.skip;

describe("flight runtime stream decode perf", () => {
  perfIt("prints stream decode and root-scan timing", async () => {
    const iterations = readEnvNumber("RSC_PERF_ITERATIONS", 10);
    const rowCount = readEnvNumber("RSC_PERF_ROW_COUNT", 2000);
    const chunkSize = readEnvNumber("RSC_PERF_CHUNK_SIZE", 256);
    const payload = buildFlightPayload(rowCount);

    const stats = await benchmark(iterations, payload, chunkSize);

    console.log(`\n[rsc-prism perf] iterations=${iterations} rows=${rowCount} chunk=${chunkSize}`);
    console.log(`[rsc-prism perf] stream-parse+decode avg=${formatMs(stats.avgTotalMs)}`);
    console.log(`[rsc-prism perf] root-scan count=${stats.avgRootScanCount.toFixed(2)}`);
    console.log(`[rsc-prism perf] root-scan avg=${formatMs(stats.avgRootScanMs)}`);
    console.log(`[rsc-prism perf] decode avg=${formatMs(stats.avgDecodeMs)}`);
  });
});
