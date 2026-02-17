import { MAIN_THREAD_MODULES_GLOBAL_KEY } from "../runtime-globals";
import type { FlightClientOptions } from "./types";
import { decodeWireValue, encodeWireValue } from "./wire";

function getMainThreadModules(): Record<string, Record<string, unknown>> {
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  const modules = globalState[MAIN_THREAD_MODULES_GLOBAL_KEY];
  if (typeof modules !== "object" || modules == null) {
    return {};
  }
  return modules as Record<string, Record<string, unknown>>;
}

function resolveClientReferenceById(id: string): unknown {
  const hashIndex = id.lastIndexOf("#");
  const moduleId = hashIndex === -1 ? id : id.slice(0, hashIndex);
  const exportName = hashIndex === -1 ? "default" : id.slice(hashIndex + 1);
  const modules = getMainThreadModules();
  const moduleExports = modules[moduleId];
  if (moduleExports == null) {
    throw new Error(`[rsc-prism] Unknown client module "${moduleId}" in minimal Flight runtime.`);
  }
  if (exportName === "*") {
    return moduleExports;
  }
  if (!(exportName in moduleExports)) {
    throw new Error(`[rsc-prism] Unknown client export "${id}" in minimal Flight runtime.`);
  }
  return moduleExports[exportName];
}

interface ParsedFlightRow {
  id: string | null;
  payload: unknown;
}

function parseFlightRow(row: string): ParsedFlightRow {
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

function canResolveRows(value: unknown, rowsById: Map<string, unknown>, visiting: Set<string>): boolean {
  if (typeof value !== "object" || value == null) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => canResolveRows(item, rowsById, visiting));
  }

  const tagged = value as Record<string, unknown>;
  if (tagged.$t === "rowRef") {
    const rowId = String(tagged.id);
    if (!rowsById.has(rowId)) {
      return false;
    }
    if (visiting.has(rowId)) {
      return true;
    }

    visiting.add(rowId);
    const canResolve = canResolveRows(rowsById.get(rowId), rowsById, visiting);
    visiting.delete(rowId);
    return canResolve;
  }

  return Object.values(tagged).every((item) => canResolveRows(item, rowsById, visiting));
}

function materializeRows(value: unknown, rowsById: Map<string, unknown>, visiting: Set<string>): unknown {
  if (typeof value !== "object" || value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => materializeRows(item, rowsById, visiting));
  }

  const tagged = value as Record<string, unknown>;
  if (tagged.$t === "rowRef") {
    const rowId = String(tagged.id);
    if (visiting.has(rowId)) {
      throw new Error(`[rsc-prism] Circular row reference "${rowId}" in Flight payload.`);
    }
    const rowValue = rowsById.get(rowId);
    if (rowValue == null) {
      throw new Error(`[rsc-prism] Missing row "${rowId}" in Flight payload.`);
    }

    visiting.add(rowId);
    const materialized = materializeRows(rowValue, rowsById, visiting);
    visiting.delete(rowId);
    return materialized;
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(tagged)) {
    result[key] = materializeRows(item, rowsById, visiting);
  }
  return result;
}

async function parseFlightPayloadFromStream(stream: ReadableStream<Uint8Array>): Promise<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let buffered = "";
  let fallbackPayload: unknown = null;
  let hasFallbackPayload = false;
  const rowsById = new Map<string, unknown>();
  let shouldCancelReader = false;

  const consumeLine = (line: string): unknown => {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return undefined;
    }

    const parsed = parseFlightRow(trimmed);
    if (!hasFallbackPayload) {
      fallbackPayload = parsed.payload;
      hasFallbackPayload = true;
    }

    if (parsed.id == null) {
      return parsed.payload;
    }

    rowsById.set(parsed.id, parsed.payload);
    const root = rowsById.get("0");
    if (root != null && canResolveRows(root, rowsById, new Set<string>())) {
      return materializeRows(root, rowsById, new Set<string>());
    }

    return undefined;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });

      while (true) {
        const lineBreakIndex = buffered.indexOf("\n");
        if (lineBreakIndex === -1) {
          break;
        }
        const parsed = consumeLine(buffered.slice(0, lineBreakIndex));
        buffered = buffered.slice(lineBreakIndex + 1);
        if (parsed !== undefined) {
          shouldCancelReader = true;
          return parsed;
        }
      }
    }

    buffered += decoder.decode();
    if (buffered.length > 0) {
      const parsed = consumeLine(buffered);
      if (parsed !== undefined) {
        shouldCancelReader = true;
        return parsed;
      }
    }
  } finally {
    if (shouldCancelReader) {
      try {
        await reader.cancel();
      } catch {
        // Some stream implementations may reject cancellation after completion.
      }
    }
    reader.releaseLock();
  }

  const root = rowsById.get("0");
  if (root != null && canResolveRows(root, rowsById, new Set<string>())) {
    return materializeRows(root, rowsById, new Set<string>());
  }

  if (!hasFallbackPayload) {
    return null;
  }
  return fallbackPayload;
}

export async function createFromReadableStream<T>(
  stream: ReadableStream<Uint8Array>,
  _options?: FlightClientOptions,
): Promise<T> {
  const parsed = await parseFlightPayloadFromStream(stream);
  return decodeWireValue(parsed, resolveClientReferenceById) as T;
}

export async function encodeReply(value: unknown): Promise<FormData | string> {
  return JSON.stringify(encodeWireValue(value));
}
