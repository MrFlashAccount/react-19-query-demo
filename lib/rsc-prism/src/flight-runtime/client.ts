import { MAIN_THREAD_MODULES_GLOBAL_KEY } from "../runtime-globals";
import type { FlightClientOptions } from "./types";
import {
  binaryWireTagFromKind,
  decodeBinaryWireRow,
  decodeWireValue,
  encodeWireValueWithBinaryRows,
  isBinaryWireRowTag,
} from "./wire";
import type { ClientManifestMap } from "../types";

const FLIGHT_PERF_GLOBAL_KEY = "__rscPrismFlightPerf";

type FlightPerfStats = {
  rootScanCount: number;
  rootScanTimeMs: number;
  decodeCount: number;
  decodeTimeMs: number;
};

function getFlightPerfStats(): FlightPerfStats | null {
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  const candidate = globalState[FLIGHT_PERF_GLOBAL_KEY];
  if (typeof candidate !== "object" || candidate == null) {
    return null;
  }
  return candidate as FlightPerfStats;
}

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

function parseJsonFlightRow(id: string, rowBytes: Uint8Array, decoder: TextDecoder): ParsedFlightRow {
  return {
    id,
    payload: JSON.parse(decoder.decode(rowBytes)),
  };
}

function joinByteChunks(chunks: Uint8Array[], totalLength: number): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0];
  }
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    output.set(chunks[i], offset);
    offset += chunks[i].byteLength;
  }
  return output;
}

function collectUnresolvedRowRefs(
  value: unknown,
  rowsById: Map<string, unknown>,
  unresolved: Set<string>,
  scannedRows: Set<string>,
  visitingRows: Set<string>,
): void {
  if (typeof value !== "object" || value == null) {
    return;
  }
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUnresolvedRowRefs(item, rowsById, unresolved, scannedRows, visitingRows);
    }
    return;
  }

  const tagged = value as Record<string, unknown>;
  if (tagged.$t === "arrayBufferBinary" || tagged.$t === "typedBinary") {
    return;
  }
  if (tagged.$t === "rowRef") {
    const rowId = String(tagged.id);
    if (visitingRows.has(rowId) || scannedRows.has(rowId)) {
      return;
    }
    const rowValue = rowsById.get(rowId);
    if (rowValue == null) {
      unresolved.add(rowId);
      return;
    }
    scannedRows.add(rowId);
    visitingRows.add(rowId);
    collectUnresolvedRowRefs(rowValue, rowsById, unresolved, scannedRows, visitingRows);
    visitingRows.delete(rowId);
    return;
  }

  for (const item of Object.values(tagged)) {
    collectUnresolvedRowRefs(item, rowsById, unresolved, scannedRows, visitingRows);
  }
}

async function parseFlightPayloadFromStream(
  stream: ReadableStream<Uint8Array>,
  resolveClientReference: (id: string) => unknown,
): Promise<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const perfStats = getFlightPerfStats();
  let fallbackPayload: unknown = null;
  let hasFallbackPayload = false;
  const rowsById = new Map<string, unknown>();
  let rootPayload: unknown = null;
  let hasRootPayload = false;
  let hasInitializedRootRefs = false;
  const pendingRootRefs = new Set<string>();
  const scannedResolvedRows = new Set<string>();
  let shouldCancelReader = false;
  const resolveRowReference = (rowId: string): unknown => rowsById.get(rowId);
  let rowIdBuffer = "";
  let parsingRowTag = false;
  let binaryTag: string | null = null;
  let binaryLengthText = "";
  let binaryExpectedLength = 0;
  let binaryReceivedLength = 0;
  let binaryParts: Uint8Array[] = [];
  let jsonParts: Uint8Array[] = [];
  let jsonByteLength = 0;

  const tryResolveRoot = (): unknown => {
    if (!hasRootPayload || rootPayload == null) {
      return undefined;
    }
    if (!hasInitializedRootRefs) {
      const scanStart = perfStats == null ? 0 : performance.now();
      pendingRootRefs.clear();
      scannedResolvedRows.clear();
      collectUnresolvedRowRefs(
        rootPayload,
        rowsById,
        pendingRootRefs,
        scannedResolvedRows,
        new Set<string>(),
      );
      hasInitializedRootRefs = true;
      if (perfStats != null) {
        perfStats.rootScanCount += 1;
        perfStats.rootScanTimeMs += performance.now() - scanStart;
      }
    }
    if (pendingRootRefs.size === 0) {
      const decodeStart = perfStats == null ? 0 : performance.now();
      const decoded = decodeWireValue(rootPayload, resolveClientReference, resolveRowReference);
      if (perfStats != null) {
        perfStats.decodeCount += 1;
        perfStats.decodeTimeMs += performance.now() - decodeStart;
      }
      return decoded;
    }
    return undefined;
  };

  const consumeParsedRow = (parsed: ParsedFlightRow): unknown => {
    if (parsed.id == null && parsed.payload == null) {
      return undefined;
    }
    if (!hasFallbackPayload) {
      fallbackPayload = parsed.payload;
      hasFallbackPayload = true;
    }

    if (parsed.id == null) {
      const decodeStart = perfStats == null ? 0 : performance.now();
      const decoded = decodeWireValue(parsed.payload, resolveClientReference, resolveRowReference);
      if (perfStats != null) {
        perfStats.decodeCount += 1;
        perfStats.decodeTimeMs += performance.now() - decodeStart;
      }
      return decoded;
    }

    rowsById.set(parsed.id, parsed.payload);
    if (parsed.id === "0") {
      rootPayload = parsed.payload;
      hasRootPayload = true;
      hasInitializedRootRefs = false;
      pendingRootRefs.clear();
      scannedResolvedRows.clear();
      return tryResolveRoot();
    }

    if (hasInitializedRootRefs && pendingRootRefs.delete(parsed.id)) {
      scannedResolvedRows.add(parsed.id);
      collectUnresolvedRowRefs(
        parsed.payload,
        rowsById,
        pendingRootRefs,
        scannedResolvedRows,
        new Set<string>([parsed.id]),
      );
      return tryResolveRoot();
    }

    return undefined;
  };

  const finalizeJsonRow = (): unknown => {
    const rowBytes = joinByteChunks(jsonParts, jsonByteLength);
    jsonParts = [];
    jsonByteLength = 0;
    const parsed = parseJsonFlightRow(rowIdBuffer, rowBytes, decoder);
    rowIdBuffer = "";
    parsingRowTag = false;
    return consumeParsedRow(parsed);
  };

  const finalizeBinaryRow = (): unknown => {
    const rowBytes = joinByteChunks(binaryParts, binaryExpectedLength);
    const parsed: ParsedFlightRow = {
      id: rowIdBuffer,
      payload: decodeBinaryWireRow(binaryTag as string, rowBytes),
    };
    rowIdBuffer = "";
    parsingRowTag = false;
    binaryTag = null;
    binaryLengthText = "";
    binaryExpectedLength = 0;
    binaryReceivedLength = 0;
    binaryParts = [];
    return consumeParsedRow(parsed);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      let offset = 0;
      while (offset < value.length) {
        if (binaryTag != null) {
          if (binaryExpectedLength === 0) {
            let foundComma = false;
            while (offset < value.length) {
              const byte = value[offset];
              offset += 1;
              if (byte === 44) {
                binaryExpectedLength = Number.parseInt(binaryLengthText, 16);
                if (!Number.isFinite(binaryExpectedLength) || binaryExpectedLength < 0) {
                  throw new Error(`[rsc-prism] Invalid binary row length "${binaryLengthText}".`);
                }
                binaryLengthText = "";
                foundComma = true;
                break;
              }
              binaryLengthText += String.fromCharCode(byte);
            }
            if (!foundComma) {
              continue;
            }
          }

          if (binaryReceivedLength < binaryExpectedLength) {
            const remaining = binaryExpectedLength - binaryReceivedLength;
            const available = value.length - offset;
            const take = remaining < available ? remaining : available;
            if (take > 0) {
              binaryParts.push(value.subarray(offset, offset + take));
              binaryReceivedLength += take;
              offset += take;
            }
            if (binaryReceivedLength < binaryExpectedLength) {
              continue;
            }
          }

          if (offset >= value.length) {
            continue;
          }
          if (value[offset] !== 10) {
            throw new Error("[rsc-prism] Invalid binary row terminator.");
          }
          offset += 1;
          const parsed = finalizeBinaryRow();
          if (parsed !== undefined) {
            shouldCancelReader = true;
            return parsed;
          }
          continue;
        }

        const byte = value[offset];
        if (!parsingRowTag) {
          offset += 1;
          if (byte === 58) {
            parsingRowTag = true;
            continue;
          }
          if (byte === 10) {
            rowIdBuffer = "";
            continue;
          }
          rowIdBuffer += String.fromCharCode(byte);
          continue;
        }

        if (jsonParts.length === 0 && jsonByteLength === 0 && binaryTag == null && isBinaryWireRowTag(byte)) {
          binaryTag = String.fromCharCode(byte);
          offset += 1;
          continue;
        }

        const lineBreakIndex = value.indexOf(10, offset);
        if (lineBreakIndex === -1) {
          const part = value.subarray(offset);
          if (part.byteLength > 0) {
            jsonParts.push(part);
            jsonByteLength += part.byteLength;
          }
          break;
        }

        if (lineBreakIndex > offset) {
          const part = value.subarray(offset, lineBreakIndex);
          jsonParts.push(part);
          jsonByteLength += part.byteLength;
        }
        offset = lineBreakIndex + 1;
        const parsed = finalizeJsonRow();
        if (parsed !== undefined) {
          shouldCancelReader = true;
          return parsed;
        }
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

  if (binaryTag != null || rowIdBuffer.length > 0 || jsonByteLength > 0) {
    throw new Error("[rsc-prism] Incomplete Flight stream row.");
  }

  const resolvedRoot = tryResolveRoot();
  if (resolvedRoot !== undefined) {
    return resolvedRoot;
  }

  if (!hasFallbackPayload) {
    return null;
  }
  const decodeStart = perfStats == null ? 0 : performance.now();
  const decoded = decodeWireValue(fallbackPayload, resolveClientReference, resolveRowReference);
  if (perfStats != null) {
    perfStats.decodeCount += 1;
    perfStats.decodeTimeMs += performance.now() - decodeStart;
  }
  return decoded;
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
  let nextBinaryPartId = 1;
  let formData: FormData | null = null;
  const encoded = encodeWireValueWithBinaryRows(value, (kind, bytes) => {
    const id = nextBinaryPartId;
    nextBinaryPartId += 1;
    const tag = binaryWireTagFromKind(kind);
    if (formData == null) {
      formData = new FormData();
    }
    const binaryPart = new Uint8Array(bytes.byteLength);
    binaryPart.set(bytes);
    formData.append(`${id}:${tag}`, new Blob([binaryPart]));
    return `${id}:${tag}`;
  });

  if (formData == null) {
    return JSON.stringify(encoded);
  }
  (formData as FormData).append("0", JSON.stringify(encoded));
  return formData as FormData;
}
