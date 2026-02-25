import { describe, it } from "vitest";

import { createFromRowEmitter } from "../../src/flight-runtime/client";
import { ROW_DONE, ROW_MODEL } from "../../src/flight-runtime/wire";

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

function readChunkSizes(name: string, fallback: number[]): number[] {
  const raw = process.env[name];
  if (raw == null || raw.trim().length === 0) {
    return fallback;
  }
  const parsed = raw
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
  return parsed.length === 0 ? fallback : parsed;
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

function buildFlightRows(rowCount: number): { k: number; id?: number; v?: unknown }[] {
  const rows: { k: number; id?: number; v?: unknown }[] = [];
  const refs = new Array(rowCount);
  for (let i = 0; i < rowCount; i += 1) {
    refs[i] = { $t: "rowRef" as const, id: i + 1 };
  }
  rows.push({ k: ROW_MODEL, id: 0, v: refs });
  for (let i = 0; i < rowCount; i += 1) {
    rows.push({ k: ROW_MODEL, id: i + 1, v: { i, text: `v${i}` } });
  }
  rows.push({ k: ROW_DONE });
  return rows;
}

async function benchmark(
  iterations: number,
  rowCount: number,
  _chunkSize: number,
): Promise<{
  avgTotalMs: number;
  avgRootScanCount: number;
  avgRootScanMs: number;
  avgDecodeMs: number;
}> {
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  const rows = buildFlightRows(rowCount);

  for (let i = 0; i < 2; i += 1) {
    globalState[PERF_KEY] = createStats();
    const emitter = createFromRowEmitter<unknown[]>();
    for (const row of rows) {
      emitter.push(row as Parameters<typeof emitter.push>[0]);
    }
    await emitter.result;
  }

  let totalMs = 0;
  let totalRootScanCount = 0;
  let totalRootScanMs = 0;
  let totalDecodeMs = 0;
  for (let i = 0; i < iterations; i += 1) {
    const stats = createStats();
    globalState[PERF_KEY] = stats;
    const start = performance.now();
    const emitter = createFromRowEmitter<unknown[]>();
    for (const row of rows) {
      emitter.push(row as Parameters<typeof emitter.push>[0]);
    }
    const result = (await emitter.result) as unknown[];
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

describe("flight runtime row decode perf", () => {
  perfIt("prints row decode and root-scan timing", async () => {
    const iterations = readEnvNumber("RSC_PERF_ITERATIONS", 10);
    const rowCount = readEnvNumber("RSC_PERF_ROW_COUNT", 8000);
    const chunkSizes = readChunkSizes("RSC_PERF_CHUNK_SIZES", [64, 256, 1024]);

    console.log(`\n[rsc-prism perf] iterations=${iterations} rows=${rowCount}`);
    for (let i = 0; i < chunkSizes.length; i += 1) {
      const chunkSize = chunkSizes[i];
      const stats = await benchmark(iterations, rowCount, chunkSize);
      console.log(`[rsc-prism perf] chunk=${chunkSize}`);
      console.log(`[rsc-prism perf] row-decode avg=${formatMs(stats.avgTotalMs)}`);
      console.log(`[rsc-prism perf] root-scan count=${stats.avgRootScanCount.toFixed(2)}`);
      console.log(`[rsc-prism perf] root-scan avg=${formatMs(stats.avgRootScanMs)}`);
      console.log(`[rsc-prism perf] decode avg=${formatMs(stats.avgDecodeMs)}`);
    }
  });
});
