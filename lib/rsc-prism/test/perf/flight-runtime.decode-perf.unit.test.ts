import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it } from "vitest";

import {
  binaryWireTagFromKind,
  createLazyChunkWrapper,
  createModelReviver,
  decodeBinaryWireRow,
  decodeWireValue,
  encodeWireValue,
  encodeWireValueWithBinaryRows,
} from "../../src/flight-runtime/wire";

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

function benchmark<T>(
  name: string,
  iterations: number,
  fn: () => T,
): { name: string; avgMs: number } {
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
  const rawRowsById = new Map<number, string>();
  let fallback: unknown = null;
  let hasFallback = false;
  let hasRoot = false;

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
    rawRowsById.set(Number.parseInt(parsed.id, 16), trimmed.slice(trimmed.indexOf(":") + 1));
    if (parsed.id === "0") {
      hasRoot = true;
    }
  }

  if (hasRoot && typeof rowsById.get("0") === "string") {
    type PerfChunk = {
      status: "pending" | "resolved" | "initialized";
      value: unknown;
      then: (resolve?: (value: unknown) => void) => void;
    };
    const chunks = new Map<number, PerfChunk>();
    const getChunk = (id: number): PerfChunk => {
      const cached = chunks.get(id);
      if (cached != null) {
        return cached;
      }
      const pending: PerfChunk = {
        status: rawRowsById.has(id) ? "resolved" : "pending",
        value: rawRowsById.get(id) ?? null,
        then(resolve) {
          if (this.status === "initialized" && resolve != null) {
            resolve(this.value);
          }
        },
      };
      chunks.set(id, pending);
      return pending;
    };
    const readChunk = (chunk: PerfChunk): unknown => {
      if (chunk.status === "initialized") {
        return chunk.value;
      }
      if (chunk.status === "pending") {
        throw chunk;
      }
      chunk.value = JSON.parse(chunk.value as string, reviver);
      chunk.status = "initialized";
      return chunk.value;
    };
    const reviver = createModelReviver({
      getChunk,
      readChunk,
      createLazyChunkWrapper: (chunk) =>
        createLazyChunkWrapper(chunk, (payload) => readChunk(payload as PerfChunk)),
      resolveClientReference: (id: string) => `client:${id}`,
    });

    const materialize = (value: unknown): unknown => {
      if (typeof value !== "object" || value == null) {
        return value;
      }
      const candidate = value as { $$typeof?: unknown; _payload?: unknown; _init?: unknown };
      if (
        candidate.$$typeof === Symbol.for("react.lazy") &&
        typeof candidate._init === "function"
      ) {
        return materialize((candidate._init as (payload: unknown) => unknown)(candidate._payload));
      }
      if (Array.isArray(value)) {
        for (let idx = 0; idx < value.length; idx += 1) {
          value[idx] = materialize(value[idx]);
        }
        return value;
      }
      if (value instanceof Map) {
        const next = new Map<unknown, unknown>();
        for (const [entryKey, entryValue] of value.entries()) {
          next.set(materialize(entryKey), materialize(entryValue));
        }
        return next;
      }
      if (value instanceof Set) {
        const next = new Set<unknown>();
        for (const item of value.values()) {
          next.add(materialize(item));
        }
        return next;
      }
      const objectValue = value as Record<string, unknown>;
      const keys = Object.keys(objectValue);
      for (let idx = 0; idx < keys.length; idx += 1) {
        const key = keys[idx];
        objectValue[key] = materialize(objectValue[key]);
      }
      return objectValue;
    };

    return materialize(readChunk(getChunk(0)));
  }

  if (hasRoot) {
    return decodeWireValue(
      rowsById.get("0"),
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
  });
}

function buildSyntheticBinaryWirePayload(
  rowCount: number,
  bytesPerRow: number,
): {
  encoded: unknown;
  rowsById: Map<string, unknown>;
} {
  const rowsById = new Map<string, unknown>();
  const payload: Array<{ idx: number; bytes: Uint8Array; floats: Float64Array; raw: ArrayBuffer }> =
    [];
  for (let i = 0; i < rowCount; i += 1) {
    const bytes = new Uint8Array(bytesPerRow);
    const floats = new Float64Array(Math.max(4, Math.floor(bytesPerRow / 8)));
    for (let j = 0; j < bytes.length; j += 1) {
      bytes[j] = (i + j) & 255;
    }
    for (let j = 0; j < floats.length; j += 1) {
      floats[j] = i * 0.5 + j * 1.25;
    }
    payload.push({ idx: i, bytes, floats, raw: bytes.buffer.slice(0) });
  }
  const encoded = encodeWireValueWithBinaryRows(payload, (kind, bytes) => {
    const id = String(rowsById.size + 1);
    const tag = binaryWireTagFromKind(kind);
    rowsById.set(id, decodeBinaryWireRow(tag, bytes));
    return id;
  });
  return { encoded, rowsById };
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

    const binaryRowCount = readEnvNumber("RSC_PERF_BINARY_ROW_COUNT", 3000);
    const binaryBytesPerRow = readEnvNumber("RSC_PERF_BINARY_ROW_BYTES", 256);
    const binaryWire = buildSyntheticBinaryWirePayload(binaryRowCount, binaryBytesPerRow);
    rows.push(
      benchmark(
        `synthetic-binary-wire-decode:rows=${binaryRowCount}:bytes=${binaryBytesPerRow}`,
        iterations,
        () =>
          decodeWireValue(
            binaryWire.encoded,
            (id) => `client:${id}`,
            (id) => binaryWire.rowsById.get(id),
          ),
      ),
    );

    const flightFile = process.env.RSC_FLIGHT_FILE;
    if (flightFile != null && flightFile.length > 0) {
      const absolutePath = resolve(process.cwd(), flightFile);
      const raw = readFileSync(absolutePath, "utf8");
      rows.push(
        benchmark(`flight-file-parse+decode:${flightFile}`, iterations, () =>
          decodeFlightTextPayload(raw),
        ),
      );
    }

    console.log(`\n[rsc-prism perf] iterations=${iterations}`);
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      console.log(`[rsc-prism perf] ${row.name} avg=${formatMs(row.avgMs)}`);
    }
  });
});
