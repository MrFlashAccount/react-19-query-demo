import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it } from "vitest";

import { decodeWireValue, encodeWireValue } from "../../src/flight-runtime/wire";

function readEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

function benchmark<T>(name: string, iterations: number, fn: () => T): { name: string; avgMs: number } {
  for (let i = 0; i < 3; i += 1) {
    fn();
  }
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    fn();
  }
  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;
  return { name, avgMs };
}

function parseFlightRow(row: string): { id: string | null; payload: unknown } {
  const separatorIndex = row.indexOf(":");
  if (separatorIndex === -1) {
    return {
      id: null,
      payload: JSON.parse(row),
    };
  }
  return {
    id: row.slice(0, separatorIndex).trim(),
    payload: JSON.parse(row.slice(separatorIndex + 1)),
  };
}

function decodeFlightTextPayload(payloadText: string): unknown {
  const rowsById = new Map<string, unknown>();
  let fallback: unknown = null;
  let hasFallback = false;
  let root: unknown = null;

  const lines = payloadText.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0) {
      continue;
    }
    const parsed = parseFlightRow(trimmed);
    if (!hasFallback) {
      fallback = parsed.payload;
      hasFallback = true;
    }
    if (parsed.id == null) {
      return decodeWireValue(parsed.payload, (id) => `client:${id}`);
    }
    rowsById.set(parsed.id, parsed.payload);
    if (parsed.id === "0") {
      root = parsed.payload;
    }
  }

  if (root != null) {
    return decodeWireValue(
      root,
      (id) => `client:${id}`,
      (id) => rowsById.get(id),
    );
  }
  if (!hasFallback) {
    return null;
  }
  return decodeWireValue(
    fallback,
    (id) => `client:${id}`,
    (id) => rowsById.get(id),
  );
}

function buildSyntheticWirePayload(): unknown {
  const map = new Map<string, unknown>();
  const set = new Set<string>();
  const form = new FormData();
  const nested: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 5000; i += 1) {
    map.set(`k${i}`, { i, mod: i % 7, ok: i % 2 === 0 });
    set.add(`s${i}`);
    form.append(`f${i}`, String(i));
    nested.push({ a: i, b: i + 1, c: [i, i + 1, i + 2] });
  }
  return encodeWireValue({
    map,
    set,
    form,
    nested,
    bytes: new Uint8Array(32 * 1024),
  });
}

const perfIt = process.env.RSC_PERF === "1" ? it : it.skip;

describe("flight decode perf harness", () => {
  perfIt("prints decode timing report", () => {
    const iterations = readEnvNumber("RSC_PERF_ITERATIONS", 20);
    const rows: Array<{ name: string; avgMs: number }> = [];

    const syntheticWire = buildSyntheticWirePayload();
    rows.push(
      benchmark("synthetic-wire-decode", iterations, () =>
        decodeWireValue(syntheticWire, (id) => `client:${id}`),
      ),
    );

    const wireFile = process.env.RSC_WIRE_FILE;
    if (wireFile != null && wireFile.length > 0) {
      const absolutePath = resolve(process.cwd(), wireFile);
      const raw = readFileSync(absolutePath, "utf8");
      const payload = JSON.parse(raw);
      rows.push(
        benchmark(`wire-file-decode:${wireFile}`, iterations, () =>
          decodeWireValue(payload, (id) => `client:${id}`),
        ),
      );
    }

    const flightFile = process.env.RSC_FLIGHT_FILE;
    if (flightFile != null && flightFile.length > 0) {
      const absolutePath = resolve(process.cwd(), flightFile);
      const raw = readFileSync(absolutePath, "utf8");
      rows.push(
        benchmark(`flight-file-parse+decode:${flightFile}`, iterations, () => decodeFlightTextPayload(raw)),
      );
    }

    console.log(`\n[rsc-prism perf] iterations=${iterations}`);
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      console.log(`[rsc-prism perf] ${row.name} avg=${formatMs(row.avgMs)}`);
    }
  });
});
