import { MAIN_THREAD_MODULES_GLOBAL_KEY } from "../runtime-globals";
import type { FlightClientOptions } from "./types";
import { decodeWireValue, encodeWireValue } from "./wire";
import type { ClientManifestMap } from "../types";

function getMainThreadModules(): Record<string, Record<string, unknown>> {
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  const modules = globalState[MAIN_THREAD_MODULES_GLOBAL_KEY];
  if (typeof modules !== "object" || modules == null) {
    return {};
  }
  return modules as Record<string, Record<string, unknown>>;
}

function resolveClientReferenceById(id: string, manifest?: ClientManifestMap | null): unknown {
  const mapped = manifest?.[id];
  const resolvedId = mapped == null ? id : `${mapped.id}#${mapped.name}`;

  const hashIndex = resolvedId.lastIndexOf("#");
  const moduleId = hashIndex === -1 ? resolvedId : resolvedId.slice(0, hashIndex);
  const exportName = hashIndex === -1 ? "default" : resolvedId.slice(hashIndex + 1);
  const modules = getMainThreadModules();
  const moduleExports = modules[moduleId];
  if (moduleExports == null) {
    throw new Error(`[rsc-prism] Unknown client module "${moduleId}" in minimal Flight runtime.`);
  }
  if (exportName === "*") {
    return moduleExports;
  }
  if (!(exportName in moduleExports)) {
    throw new Error(`[rsc-prism] Unknown client export "${resolvedId}" in minimal Flight runtime.`);
  }
  return moduleExports[exportName];
}

function toManifestMap(options?: FlightClientOptions): ClientManifestMap | null {
  const manifest = options?.manifest;
  if (manifest == null || typeof manifest === "string") {
    return null;
  }
  return manifest;
}

function createClientReferenceResolver(options?: FlightClientOptions): (id: string) => unknown {
  const manifest = toManifestMap(options);
  return (id: string) => resolveClientReferenceById(id, manifest);
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

function collectMissingRowRefs(
  value: unknown,
  rowsById: Map<string, unknown>,
  missing: Set<string>,
  visiting: Set<string>,
): void {
  if (typeof value !== "object" || value == null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectMissingRowRefs(item, rowsById, missing, visiting);
    }
    return;
  }

  const tagged = value as Record<string, unknown>;
  if (tagged.$t === "rowRef") {
    const rowId = String(tagged.id);
    const rowValue = rowsById.get(rowId);
    if (rowValue == null) {
      missing.add(rowId);
      return;
    }
    if (visiting.has(rowId)) {
      return;
    }
    visiting.add(rowId);
    collectMissingRowRefs(rowValue, rowsById, missing, visiting);
    visiting.delete(rowId);
    return;
  }

  for (const item of Object.values(tagged)) {
    collectMissingRowRefs(item, rowsById, missing, visiting);
  }
}

async function parseFlightPayloadFromStream(
  stream: ReadableStream<Uint8Array>,
  resolveClientReference: (id: string) => unknown,
): Promise<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let carry = "";
  let fallbackPayload: unknown = null;
  let hasFallbackPayload = false;
  const rowsById = new Map<string, unknown>();
  let rootPayload: unknown = null;
  let hasRootPayload = false;
  let pendingRootRefs: Set<string> | null = null;
  let shouldCancelReader = false;
  const resolveRowReference = (rowId: string): unknown => rowsById.get(rowId);

  const tryResolveRoot = (): unknown => {
    if (!hasRootPayload || rootPayload == null) {
      return undefined;
    }
    if (pendingRootRefs == null) {
      const missing = new Set<string>();
      collectMissingRowRefs(rootPayload, rowsById, missing, new Set<string>());
      pendingRootRefs = missing;
    }
    if (pendingRootRefs.size === 0) {
      return decodeWireValue(rootPayload, resolveClientReference, resolveRowReference);
    }
    return undefined;
  };

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
      return decodeWireValue(parsed.payload, resolveClientReference, resolveRowReference);
    }

    rowsById.set(parsed.id, parsed.payload);
    if (parsed.id === "0") {
      rootPayload = parsed.payload;
      hasRootPayload = true;
      pendingRootRefs = null;
      return tryResolveRoot();
    }

    if (pendingRootRefs != null && pendingRootRefs.has(parsed.id)) {
      pendingRootRefs = null;
      return tryResolveRoot();
    }

    return undefined;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      let buffered = carry.length === 0 ? chunk : `${carry}${chunk}`;
      carry = "";

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
      carry = buffered;
    }

    const trailing = decoder.decode();
    const buffered = carry.length === 0 ? trailing : `${carry}${trailing}`;
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

  const resolvedRoot = tryResolveRoot();
  if (resolvedRoot !== undefined) {
    return resolvedRoot;
  }

  if (!hasFallbackPayload) {
    return null;
  }
  return decodeWireValue(fallbackPayload, resolveClientReference, resolveRowReference);
}

export async function createFromReadableStream<T>(
  stream: ReadableStream<Uint8Array>,
  options?: FlightClientOptions,
): Promise<T> {
  const resolveClientReference = createClientReferenceResolver(options);
  const parsed = await parseFlightPayloadFromStream(stream, resolveClientReference);
  return parsed as T;
}

export async function encodeReply(value: unknown): Promise<FormData | string> {
  return JSON.stringify(encodeWireValue(value));
}
