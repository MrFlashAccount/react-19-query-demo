import { MAIN_THREAD_MODULES_GLOBAL_KEY } from "../runtime-globals";
import type { FlightClientOptions } from "./types";
import {
  binaryWireTagFromKind,
  createLazyChunkWrapper,
  createModelReviver,
  decodeBinaryWireRow,
  type FlightRowMessage,
  encodeWireValueWithBinaryRows,
  isBinaryWireRowTag,
  ROW_BINARY,
  ROW_DONE,
  ROW_ERROR,
  ROW_MODEL,
} from "./wire";
import type { ClientManifestMap } from "../types";

const CHUNK_PENDING = 0;
const CHUNK_RESOLVED_MODEL = 1;
const CHUNK_INITIALIZED = 2;
const CHUNK_ERRORED = 3;

type ChunkStatus =
  | typeof CHUNK_PENDING
  | typeof CHUNK_RESOLVED_MODEL
  | typeof CHUNK_INITIALIZED
  | typeof CHUNK_ERRORED;

type ChunkResolveListener<T> = (value: T) => void;
type ChunkRejectListener = (reason: unknown) => void;

interface FlightChunk<T = unknown> {
  status: ChunkStatus;
  value: T | string | null;
  reason: unknown;
  listeners: ChunkResolveListener<T>[] | null;
  rejectListeners: ChunkRejectListener[] | null;
  then: (resolve?: ChunkResolveListener<T>, reject?: ChunkRejectListener) => void;
}

interface FlightResponse {
  chunks: Map<number, FlightChunk<any>>;
  resolveClientReference: (id: string) => unknown;
  fromJSON: (this: unknown, key: string, value: unknown) => unknown;
  closed: boolean;
  closedReason: unknown;
}

const REACT_LAZY_SYMBOL = Symbol.for("react.lazy");

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value != null && "then" in value;
}

function isLazyWrapper(
  value: unknown,
): value is { $$typeof: symbol; _payload: unknown; _init: (payload: unknown) => unknown } {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  const candidate = value as { $$typeof?: unknown; _payload?: unknown; _init?: unknown };
  return candidate.$$typeof === REACT_LAZY_SYMBOL && typeof candidate._init === "function";
}

function createPendingChunk<T>(): FlightChunk<T> {
  return {
    status: CHUNK_PENDING,
    value: null,
    reason: null,
    listeners: null,
    rejectListeners: null,
    // oxlint-disable-next-line no-then
    then(resolve?: ChunkResolveListener<T>, reject?: ChunkRejectListener) {
      if (this.status === CHUNK_INITIALIZED || this.status === CHUNK_RESOLVED_MODEL) {
        if (resolve != null) {
          queueMicrotask(() => {
            resolve(this.value as T);
          });
        }
        return;
      }
      if (this.status === CHUNK_ERRORED) {
        if (reject != null) {
          queueMicrotask(() => {
            reject(this.reason);
          });
        }
        return;
      }
      if (resolve != null) {
        (this.listeners ??= []).push(resolve);
      }
      if (reject != null) {
        (this.rejectListeners ??= []).push(reject);
      }
    },
  };
}

function getChunk<T = unknown>(response: FlightResponse, id: number): FlightChunk<T> {
  const existing = response.chunks.get(id);
  if (existing != null) {
    return existing as FlightChunk<T>;
  }
  if (response.closed) {
    const errored = createPendingChunk<T>();
    errored.status = CHUNK_ERRORED;
    errored.reason = response.closedReason;
    response.chunks.set(id, errored);
    return errored;
  }
  const pending = createPendingChunk<T>();
  response.chunks.set(id, pending);
  return pending;
}

function wakeInitializedChunk<T>(chunk: FlightChunk<T>, value: T): void {
  const listeners = chunk.listeners;
  chunk.listeners = null;
  chunk.rejectListeners = null;
  if (listeners != null) {
    for (let i = 0; i < listeners.length; i += 1) {
      listeners[i](value);
    }
  }
}

function wakeErroredChunk<T>(chunk: FlightChunk<T>, reason: unknown): void {
  const rejectListeners = chunk.rejectListeners;
  chunk.listeners = null;
  chunk.rejectListeners = null;
  if (rejectListeners != null) {
    for (let i = 0; i < rejectListeners.length; i += 1) {
      rejectListeners[i](reason);
    }
  }
}

function errorChunk<T>(chunk: FlightChunk<T>, reason: unknown): void {
  chunk.status = CHUNK_ERRORED;
  chunk.value = null;
  chunk.reason = reason;
  wakeErroredChunk(chunk, reason);
}

function initializeModelChunk<T>(response: FlightResponse, chunk: FlightChunk<T>): void {
  if (chunk.status !== CHUNK_RESOLVED_MODEL) {
    return;
  }
  const model = chunk.value as string;
  try {
    const parsed = JSON.parse(model, response.fromJSON) as T;
    chunk.status = CHUNK_INITIALIZED;
    chunk.value = parsed;
    chunk.reason = null;
    wakeInitializedChunk(chunk, parsed);
  } catch (error) {
    if (isThenable(error)) {
      error.then(
        () => {
          initializeModelChunk(response, chunk);
        },
        (reason) => {
          errorChunk(chunk, reason);
        },
      );
      return;
    }
    errorChunk(chunk, error);
  }
}

function readChunk<T>(response: FlightResponse, chunk: FlightChunk<T>): T {
  if (chunk.status === CHUNK_RESOLVED_MODEL) {
    initializeModelChunk(response, chunk);
  }
  switch (chunk.status) {
    case CHUNK_INITIALIZED:
      return chunk.value as T;
    case CHUNK_PENDING:
    case CHUNK_RESOLVED_MODEL:
      throw chunk;
    case CHUNK_ERRORED:
      throw chunk.reason;
    default:
      throw new Error("[rsc-prism] Unexpected chunk state.");
  }
}

function resolveModelChunk(response: FlightResponse, id: number, model: string): void {
  const chunk = getChunk(response, id);
  chunk.status = CHUNK_RESOLVED_MODEL;
  chunk.value = model;
  chunk.reason = response;
  if (chunk.listeners != null || chunk.rejectListeners != null) {
    initializeModelChunk(response, chunk);
  }
}

function resolveInitializedChunk(response: FlightResponse, id: number, value: unknown): void {
  const chunk = getChunk(response, id);
  chunk.status = CHUNK_INITIALIZED;
  chunk.value = value;
  chunk.reason = null;
  wakeInitializedChunk(chunk, value);
}

function closeResponseWithError(response: FlightResponse, reason: unknown): void {
  if (response.closed) {
    return;
  }
  response.closed = true;
  response.closedReason = reason;
  const chunks = response.chunks.values();
  for (const chunk of chunks) {
    if (chunk.status === CHUNK_PENDING || chunk.status === CHUNK_RESOLVED_MODEL) {
      errorChunk(chunk, reason);
    }
  }
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

function createFlightResponse(
  resolveClientReference: (id: string) => unknown,
): FlightResponse {
  const response: FlightResponse = {
    chunks: new Map<number, FlightChunk>(),
    resolveClientReference,
    fromJSON: (_key, value) => value,
    closed: false,
    closedReason: null,
  };
  response.fromJSON = createModelReviver({
    getChunk: (id) => getChunk(response, id),
    readChunk: (chunk) => readChunk(response, chunk as FlightChunk),
    createLazyChunkWrapper: (chunk) =>
      createLazyChunkWrapper(chunk, (payload) => readChunk(response, payload as FlightChunk)),
    resolveClientReference: (id) => response.resolveClientReference(id),
  });
  return response;
}

function attachRootResolution(
  response: FlightResponse,
  resolve: (value: unknown) => void,
  reject: (reason: unknown) => void,
): void {
  const rootChunk = getChunk(response, 0);
  try {
    resolve(readChunk(response, rootChunk));
  } catch (error) {
    if (isThenable(error)) {
      error.then(
        () => attachRootResolution(response, resolve, reject),
        (reason) => reject(reason),
      );
      return;
    }
    reject(error);
  }
}

async function materializeLazyValue(value: unknown): Promise<unknown> {
  while (isLazyWrapper(value)) {
    try {
      value = value._init(value._payload);
    } catch (error) {
      if (isThenable(error)) {
        await error;
        continue;
      }
      throw error;
    }
  }
  return value;
}

async function consumeFlightStream(
  stream: ReadableStream<Uint8Array>,
  response: FlightResponse,
  onRootMaybeReady: () => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let rowId = 0;
  let hasRowId = false;
  let parsingRowTag = false;
  let hasAnyRow = false;
  let binaryTag: string | null = null;
  let hasParsedBinaryLength = false;
  let binaryExpectedLength = 0;
  let binaryReceivedLength = 0;
  let binaryParts: Uint8Array[] = [];
  let jsonParts: Uint8Array[] = [];
  let jsonByteLength = 0;

  const finalizeJsonRow = (): void => {
    const rowBytes = joinByteChunks(jsonParts, jsonByteLength);
    jsonParts = [];
    jsonByteLength = 0;
    const currentId = rowId;
    rowId = 0;
    hasRowId = false;
    parsingRowTag = false;
    const model = decoder.decode(rowBytes);
    resolveModelChunk(response, currentId, model);
    hasAnyRow = true;
    onRootMaybeReady();
  };

  const finalizeBinaryRow = (): void => {
    const rowBytes = joinByteChunks(binaryParts, binaryExpectedLength);
    const currentId = rowId;
    const payload = decodeBinaryWireRow(binaryTag as string, rowBytes);
    rowId = 0;
    hasRowId = false;
    parsingRowTag = false;
    binaryTag = null;
    hasParsedBinaryLength = false;
    binaryExpectedLength = 0;
    binaryReceivedLength = 0;
    binaryParts = [];
    resolveInitializedChunk(response, currentId, payload);
    hasAnyRow = true;
    onRootMaybeReady();
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      let offset = 0;
      while (offset < value.length) {
        if (binaryTag != null) {
          if (!hasParsedBinaryLength) {
            binaryExpectedLength = 0;
            let foundComma = false;
            while (offset < value.length) {
              const byte = value[offset];
              offset += 1;
              if (byte === 44) {
                hasParsedBinaryLength = true;
                foundComma = true;
                break;
              }
              const hexDigit = byte <= 57 ? byte - 48 : (byte | 32) - 87;
              if (hexDigit < 0 || hexDigit > 15) {
                throw new Error(`[rsc-prism] Invalid binary row length byte "${String.fromCharCode(byte)}".`);
              }
              binaryExpectedLength = binaryExpectedLength * 16 + hexDigit;
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
          finalizeBinaryRow();
          continue;
        }

        const byte = value[offset];
        if (!parsingRowTag) {
          offset += 1;
          if (byte === 58) {
            if (!hasRowId) {
              throw new Error("[rsc-prism] Missing row id in Flight payload.");
            }
            parsingRowTag = true;
            continue;
          }
          if (byte === 10) {
            rowId = 0;
            hasRowId = false;
            continue;
          }
          const digit = byte <= 57 ? byte - 48 : (byte | 32) - 87;
          if (digit >= 0 && digit <= 15) {
            rowId = rowId * 16 + digit;
            hasRowId = true;
            continue;
          }
          throw new Error(`[rsc-prism] Invalid row id byte "${String.fromCharCode(byte)}".`);
        }

        if (jsonByteLength === 0 && jsonParts.length === 0 && binaryTag == null && isBinaryWireRowTag(byte)) {
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
        finalizeJsonRow();
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (binaryTag != null || jsonByteLength > 0 || parsingRowTag || hasRowId) {
    throw new Error("[rsc-prism] Incomplete Flight stream row.");
  }
  if (!hasAnyRow) {
    resolveInitializedChunk(response, 0, null);
  }
}

export async function createFromReadableStream<T>(
  stream: ReadableStream<Uint8Array>,
  options?: FlightClientOptions,
): Promise<T> {
  const resolveClientReference = createClientReferenceResolver(options);
  const response = createFlightResponse(resolveClientReference);
  return await new Promise<T>((resolve, reject) => {
    let rootSettled = false;
    const settleRoot = (): void => {
      if (rootSettled) {
        return;
      }
      attachRootResolution(
        response,
        (value) => {
          void materializeLazyValue(value)
            .then((materialized) => {
              if (rootSettled) return;
              rootSettled = true;
              resolve(materialized as T);
            })
            .catch((error) => {
              if (rootSettled) return;
              rootSettled = true;
              reject(error);
            });
        },
        (reason) => {
          if (rootSettled) return;
          rootSettled = true;
          reject(reason);
        },
      );
    };
    void consumeFlightStream(stream, response, settleRoot).catch((error) => {
      closeResponseWithError(response, error);
      if (!rootSettled) {
        rootSettled = true;
        reject(error);
      }
    });
    settleRoot();
  });
}

export function createFromRowEmitter<T>(
  options?: FlightClientOptions,
): {
  push: (row: FlightRowMessage) => void;
  result: Promise<T>;
} {
  const resolveClientReference = createClientReferenceResolver(options);
  const response = createFlightResponse(resolveClientReference);
  let hasAnyRow = false;
  let rootSettled = false;

  let resolveResult!: (value: T) => void;
  let rejectResult!: (reason: unknown) => void;
  const result = new Promise<T>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const settleRoot = (): void => {
    if (rootSettled) {
      return;
    }
    attachRootResolution(
      response,
      (value) => {
        void materializeLazyValue(value)
          .then((materialized) => {
            if (rootSettled) return;
            rootSettled = true;
            resolveResult(materialized as T);
          })
          .catch((error) => {
            if (rootSettled) return;
            rootSettled = true;
            rejectResult(error);
          });
      },
      (reason) => {
        if (rootSettled) return;
        rootSettled = true;
        rejectResult(reason);
      },
    );
  };

  return {
    push(row) {
      switch (row.k) {
        case ROW_MODEL:
          resolveModelChunk(response, row.id, row.v);
          hasAnyRow = true;
          settleRoot();
          return;
        case ROW_BINARY: {
          const payload = decodeBinaryWireRow(row.t, new Uint8Array(row.v));
          resolveInitializedChunk(response, row.id, payload);
          hasAnyRow = true;
          settleRoot();
          return;
        }
        case ROW_DONE:
          if (!hasAnyRow) {
            resolveInitializedChunk(response, 0, null);
          }
          settleRoot();
          return;
        case ROW_ERROR: {
          const error = new Error(row.v);
          closeResponseWithError(response, error);
          if (!rootSettled) {
            rootSettled = true;
            rejectResult(error);
          }
          return;
        }
      }
    },
    result,
  };
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
