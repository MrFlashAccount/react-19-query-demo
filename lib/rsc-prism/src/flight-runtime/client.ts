import { MAIN_THREAD_MODULES_GLOBAL_KEY } from "../runtime-globals";
import type { FlightClientOptions } from "./types";
import {
  binaryWireTagFromKind,
  createLazyChunkWrapper,
  decodeBinaryWireRow,
  decodeWireValue,
  type FlightRowMessage,
  type RevivePathTree,
  encodeWireValueWithBinaryRows,
  ROW_BINARY,
  ROW_DONE,
  ROW_ERROR,
  ROW_METADATA,
  ROW_MODEL,
} from "./wire";
import type { ClientManifestMap } from "../types";
import type { ComponentTraceTracker } from "../types";

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
  id: number;
  status: ChunkStatus;
  value: T | null;
  reason: unknown;
  listeners: ChunkResolveListener<T>[] | null;
  rejectListeners: ChunkRejectListener[] | null;
  lateResolveQueue: ChunkResolveListener<T>[] | null;
  lateRejectQueue: ChunkRejectListener[] | null;
  lateFlushScheduled: boolean;
  then: (resolve?: ChunkResolveListener<T>, reject?: ChunkRejectListener) => void;
}

interface FlightResponse {
  chunks: Map<number, FlightChunk<any>>;
  revivePathsByRowId: Map<number, RevivePathTree>;
  resolveClientReference: (id: string) => unknown;
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>;
  closed: boolean;
  closedReason: unknown;
  traceContext?: FlightClientOptions["traceContext"];
  componentTrace?: ComponentTraceTracker;
  currentRowId?: number;
  lazyWrapperCache: Map<FlightChunk, unknown>;
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

function createPendingChunk<T>(id: number): FlightChunk<T> {
  const chunk: FlightChunk<T> = {
    id,
    status: CHUNK_PENDING,
    value: null,
    reason: null,
    listeners: null,
    rejectListeners: null,
    lateResolveQueue: null,
    lateRejectQueue: null,
    lateFlushScheduled: false,
    // oxlint-disable-next-line unicorn/no-thenable
    then(resolve?: ChunkResolveListener<T>, reject?: ChunkRejectListener) {
      if (this.status === CHUNK_INITIALIZED || this.status === CHUNK_RESOLVED_MODEL) {
        if (resolve != null) {
          (this.lateResolveQueue ??= []).push(resolve);
          if (!this.lateFlushScheduled) {
            this.lateFlushScheduled = true;
            queueMicrotask(() => {
              const queue = this.lateResolveQueue!;
              this.lateResolveQueue = null;
              this.lateFlushScheduled = false;
              const value = this.value as T;
              for (let i = 0; i < queue.length; i += 1) {
                queue[i](value);
              }
            });
          }
        }
        return;
      }
      if (this.status === CHUNK_ERRORED) {
        if (reject != null) {
          (this.lateRejectQueue ??= []).push(reject);
          if (!this.lateFlushScheduled) {
            this.lateFlushScheduled = true;
            queueMicrotask(() => {
              const queue = this.lateRejectQueue!;
              this.lateRejectQueue = null;
              this.lateFlushScheduled = false;
              const reason = this.reason;
              for (let i = 0; i < queue.length; i += 1) {
                queue[i](reason);
              }
            });
          }
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
  return chunk;
}

function getChunk<T = unknown>(response: FlightResponse, id: number): FlightChunk<T> {
  const existing = response.chunks.get(id);
  if (existing != null) {
    return existing as FlightChunk<T>;
  }
  if (response.closed) {
    const errored = createPendingChunk<T>(id);
    errored.status = CHUNK_ERRORED;
    errored.reason = response.closedReason;
    response.chunks.set(id, errored);
    return errored;
  }
  const pending = createPendingChunk<T>(id);
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
  const model = chunk.value;
  const previousRowId = response.currentRowId;
  response.currentRowId = chunk.id;
  const resolveRowReference = (id: number | string): unknown => {
    const chunkId = typeof id === "number" ? id : Number(id);
    const rowChunk = getChunk(response, chunkId);
    if (rowChunk.status === CHUNK_INITIALIZED) {
      return rowChunk.value;
    }
    const cached = response.lazyWrapperCache.get(rowChunk);
    if (cached !== undefined) return cached;
    const wrapper = createLazyChunkWrapper(rowChunk, (payload) =>
      readChunk(response, payload as FlightChunk),
    );
    response.lazyWrapperCache.set(rowChunk, wrapper);
    return wrapper;
  };
  try {
    const revived = decodeWireValue(
      model,
      response.resolveClientReference,
      resolveRowReference,
      response.callServer,
      {
        traceContext: response.traceContext,
        componentTrace: response.componentTrace,
        currentRowId: undefined,
      },
    ) as T;
    chunk.status = CHUNK_INITIALIZED;
    chunk.value = revived;
    chunk.reason = null;
    wakeInitializedChunk(chunk, revived);
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
  } finally {
    response.currentRowId = previousRowId;
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
      throw chunk;
    case CHUNK_RESOLVED_MODEL:
      throw chunk;
    case CHUNK_ERRORED:
      throw chunk.reason;
    default:
      throw new Error("[rsc-prism] Unexpected chunk state.");
  }
}

function resolveModelChunk(
  response: FlightResponse,
  id: number,
  model: unknown,
): void {
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

function createFlightResponse(
  resolveClientReference: (id: string) => unknown,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  options?: FlightClientOptions,
): FlightResponse {
  const componentTrace = options?.componentTrace;
  const lazyWrapperCache = new Map<FlightChunk, unknown>();
  return {
    chunks: new Map<number, FlightChunk>(),
    revivePathsByRowId: new Map(),
    resolveClientReference,
    callServer,
    closed: false,
    closedReason: null,
    traceContext: options?.traceContext,
    componentTrace,
    currentRowId: undefined,
    lazyWrapperCache,
  };
}

function attachRootResolution(
  response: FlightResponse,
  resolve: (value: unknown) => void,
  reject: (reason: unknown) => void,
  state: { subscribedThenable: PromiseLike<unknown> | null },
  scheduleRetry: () => void,
): void {
  const rootChunk = getChunk(response, 0);
  try {
    const resolvedValue = readChunk(response, rootChunk);
    state.subscribedThenable = null;
    resolve(resolvedValue);
  } catch (error) {
    if (isThenable(error)) {
      if (state.subscribedThenable === error) {
        return;
      }
      state.subscribedThenable = error;
      error.then(
        () => {
          if (state.subscribedThenable === error) {
            state.subscribedThenable = null;
          }
          scheduleRetry();
        },
        (reason) => {
          if (state.subscribedThenable === error) {
            state.subscribedThenable = null;
          }
          reject(reason);
        },
      );
      return;
    }
    reject(error);
  }
}

function materializeLazyValueTopLevel(value: unknown): Promise<unknown> {
  return (async (): Promise<unknown> => {
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
  })();
}

async function materializeLazyValueRecursive(value: unknown): Promise<unknown> {
  if (isLazyWrapper(value)) {
    try {
      value = value._init(value._payload);
    } catch (error) {
      if (isThenable(error)) {
        await error;
        return materializeLazyValueRecursive(value);
      }
      throw error;
    }
    return materializeLazyValueRecursive(value);
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => materializeLazyValueRecursive(item)));
  }
  if (value instanceof Map) {
    const entries = await Promise.all(
      Array.from(
        value.entries(),
        async ([k, v]) =>
          [await materializeLazyValueRecursive(k), await materializeLazyValueRecursive(v)] as const,
      ),
    );
    return new Map(entries);
  }
  if (value instanceof Set) {
    const items = await Promise.all(
      Array.from(value.values(), (item) => materializeLazyValueRecursive(item)),
    );
    return new Set(items);
  }
  if (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      result[key] = await materializeLazyValueRecursive(obj[key]);
    }
    return result;
  }
  return value;
}

const UNSUPPORTED_STREAM_MESSAGE =
  "[rsc-prism] HTTP text Flight stream is not supported. Use worker row transport (createFromRowEmitter) instead.";

export async function createFromReadableStream<T>(
  _stream: ReadableStream<Uint8Array>,
  _options?: FlightClientOptions,
): Promise<T> {
  throw new Error(UNSUPPORTED_STREAM_MESSAGE);
}

export function createFromRowEmitter<T>(options?: FlightClientOptions): {
  push: (row: FlightRowMessage) => void;
  result: Promise<T>;
} {
  const resolveClientReference = createClientReferenceResolver(options);
  const response = createFlightResponse(resolveClientReference, options?.callServer, options);
  let hasAnyRow = false;
  let rootSettled = false;
  const rootResolutionState: {
    subscribedThenable: PromiseLike<unknown> | null;
    retryQueued: boolean;
  } = {
    subscribedThenable: null,
    retryQueued: false,
  };

  let resolveResult!: (value: T) => void;
  let rejectResult!: (reason: unknown) => void;
  const result = new Promise<T>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const scheduleRootRetry = (): void => {
    if (rootSettled || rootResolutionState.retryQueued) {
      return;
    }
    rootResolutionState.retryQueued = true;
    queueMicrotask(() => {
      rootResolutionState.retryQueued = false;
      settleRoot();
    });
  };

  const settleRoot = (): void => {
    if (rootSettled) {
      return;
    }
    attachRootResolution(
      response,
      (value) => {
        const materialize =
          options?.materializeDeferredChunks === true
            ? materializeLazyValueRecursive
            : materializeLazyValueTopLevel;
        void materialize(value)
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
      rootResolutionState,
      scheduleRootRetry,
    );
  };

  return {
    push(row) {
      switch (row.k) {
        case ROW_METADATA:
          if (row.revivePaths.length > 0) {
            response.revivePathsByRowId.set(row.id, row.revivePaths);
          }
          hasAnyRow = true;
          scheduleRootRetry();
          return;
        case ROW_MODEL:
          response.currentRowId = row.id;
          resolveModelChunk(response, row.id, row.v);
          response.currentRowId = undefined;
          hasAnyRow = true;
          scheduleRootRetry();
          return;
        case ROW_BINARY: {
          const payload = decodeBinaryWireRow(row.t, new Uint8Array(row.v));
          resolveInitializedChunk(response, row.id, payload);
          hasAnyRow = true;
          scheduleRootRetry();
          return;
        }
        case ROW_DONE:
          if (!hasAnyRow) {
            resolveInitializedChunk(response, 0, null);
          }
          scheduleRootRetry();
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
    return id;
  });

  if (formData == null) {
    return JSON.stringify(encoded);
  }
  (formData as FormData).append("0", JSON.stringify(encoded));
  return formData as FormData;
}
