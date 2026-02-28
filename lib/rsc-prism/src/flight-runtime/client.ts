import { CLIENT_REF_TABLE_GLOBAL_KEY } from "../runtime-globals";
import type { FlightClientOptions } from "./types";
import {
  applyDirectPathReplacements,
  createLazyChunkWrapper,
  createModelReviver,
  decodeBinaryWireRow,
  type FlightRowMessage,
  type FlightTemplateRowShape,
  reviveModelValueTree,
  REACT_LAZY_SYMBOL,
  ROW_BINARY,
  ROW_DONE,
  ROW_ERROR,
  ROW_METADATA,
  ROW_MODEL,
} from "./wire";

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
  revivePathsByRowId: Map<number, ReadonlyArray<(string | number)[]>>;
  templatesByRowId: Map<number, FlightTemplateRowShape[]>;
  resolveClientReference: (id: number) => unknown;
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>;
  fromJSON: (this: unknown, key: string, value: unknown) => unknown;
  closed: boolean;
  closedReason: unknown;
  currentRowId?: number;
  lazyWrapperCache: Map<FlightChunk, unknown>;
}

const TEMPLATE_SLOT_KEY = "$slot";
const TEMPLATE_REF_KEY = "$tpl";
const TEMPLATE_VALUES_KEY = "$v";
const TEMPLATE_SCAN_NODE_BUDGET = 4000;

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

function expandTemplateShape(
  node: unknown,
  slots: unknown[],
  templatesById: Map<number, unknown>,
): unknown {
  if (node == null || typeof node !== "object") {
    return node;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      node[i] = expandTemplateShape(node[i], slots, templatesById);
    }
    return node;
  }
  const objectNode = node as Record<string, unknown>;
  if (typeof objectNode[TEMPLATE_SLOT_KEY] === "number") {
    return slots[objectNode[TEMPLATE_SLOT_KEY] as number];
  }
  if (
    typeof objectNode[TEMPLATE_REF_KEY] === "number" &&
    Array.isArray(objectNode[TEMPLATE_VALUES_KEY])
  ) {
    const templateShape = templatesById.get(objectNode[TEMPLATE_REF_KEY] as number);
    if (templateShape !== undefined) {
      return expandTemplateShape(
        templateShape,
        objectNode[TEMPLATE_VALUES_KEY] as unknown[],
        templatesById,
      );
    }
  }
  const out: Record<string, unknown> = {};
  const keys = Object.keys(objectNode);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    out[key] = expandTemplateShape(objectNode[key], slots, templatesById);
  }
  return out;
}

function hasTemplateReferences(node: unknown, budget: { count: number }): boolean {
  if (budget.count > TEMPLATE_SCAN_NODE_BUDGET) {
    return false;
  }
  budget.count += 1;
  if (node == null || typeof node !== "object") {
    return false;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      if (hasTemplateReferences(node[i], budget)) {
        return true;
      }
    }
    return false;
  }
  const objectNode = node as Record<string, unknown>;
  if (typeof objectNode[TEMPLATE_REF_KEY] === "number") {
    return true;
  }
  const keys = Object.keys(objectNode);
  for (let i = 0; i < keys.length; i += 1) {
    if (hasTemplateReferences(objectNode[keys[i]], budget)) {
      return true;
    }
  }
  return false;
}

function expandTemplateReferencesInPlace(
  node: unknown,
  templatesById: Map<number, unknown>,
): unknown {
  if (node == null || typeof node !== "object") {
    return node;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      node[i] = expandTemplateReferencesInPlace(node[i], templatesById);
    }
    return node;
  }
  const objectNode = node as Record<string, unknown>;
  if (
    typeof objectNode[TEMPLATE_REF_KEY] === "number" &&
    Array.isArray(objectNode[TEMPLATE_VALUES_KEY])
  ) {
    const templateShape = templatesById.get(objectNode[TEMPLATE_REF_KEY] as number);
    if (templateShape !== undefined) {
      return expandTemplateShape(
        templateShape,
        objectNode[TEMPLATE_VALUES_KEY] as unknown[],
        templatesById,
      );
    }
  }
  const keys = Object.keys(objectNode);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    objectNode[key] = expandTemplateReferencesInPlace(objectNode[key], templatesById);
  }
  return objectNode;
}

function expandTemplatesInRowValue(
  root: unknown,
  templates: FlightTemplateRowShape[] | undefined,
): unknown {
  if (templates == null || templates.length === 0) {
    return root;
  }
  if (!hasTemplateReferences(root, { count: 0 })) {
    return root;
  }
  const templatesById = new Map<number, unknown>();
  for (let i = 0; i < templates.length; i += 1) {
    templatesById.set(templates[i].id, templates[i].shape);
  }
  return expandTemplateReferencesInPlace(root, templatesById);
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
  const decodeContext = {
    getChunk: (id: number) => getChunk(response, id),
    readChunk: (c: unknown) => readChunk(response, c as FlightChunk),
    createLazyChunkWrapper: (c: unknown) => {
      const cached = response.lazyWrapperCache.get(c as FlightChunk);
      if (cached !== undefined) return cached;
      const wrapper = createLazyChunkWrapper(c, (payload) =>
        readChunk(response, payload as FlightChunk),
      );
      response.lazyWrapperCache.set(c as FlightChunk, wrapper);
      return wrapper;
    },
    resolveClientReference: (id: number) => response.resolveClientReference(id),
    callServer: response.callServer,
    getCurrentRowId: () => response.currentRowId,
  };
  const revivePaths = response.revivePathsByRowId.get(chunk.id);
  const templates = response.templatesByRowId.get(chunk.id);
  try {
    const expandedRoot = expandTemplatesInRowValue(model, templates);
    let revived: T;
    if (revivePaths != null && revivePaths.length > 0) {
      const root = expandedRoot;
      applyDirectPathReplacements(root, revivePaths, decodeContext);
      revived = root as T;
    } else {
      revived = reviveModelValueTree(decodeContext, expandedRoot) as T;
    }
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
    case CHUNK_RESOLVED_MODEL:
      throw chunk;
    case CHUNK_ERRORED:
      throw chunk.reason;
    default:
      throw new Error("[rsc-prism] Unexpected chunk state.");
  }
}

function resolveModelChunk(response: FlightResponse, id: number, model: unknown): void {
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

function resolveClientReferenceById(id: number): unknown {
  const refTable = (globalThis as Record<string, unknown>)[CLIENT_REF_TABLE_GLOBAL_KEY] as
    | unknown[]
    | undefined;
  if (refTable == null) {
    throw new Error(
      `[rsc-prism] Client ref table not initialized. Ensure main-thread bootstrap runs before Flight decode.`,
    );
  }
  const resolved = refTable[id];
  if (resolved === undefined) {
    throw new Error(`[rsc-prism] Unknown client ref id ${id} in minimal Flight runtime.`);
  }
  return resolved;
}

function createClientReferenceResolver(): (id: number) => unknown {
  return (id: number) => resolveClientReferenceById(id);
}

function createFlightResponse(
  resolveClientReference: (id: number) => unknown,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
): FlightResponse {
  const lazyWrapperCache = new Map<FlightChunk, unknown>();
  const response: FlightResponse = {
    chunks: new Map<number, FlightChunk>(),
    revivePathsByRowId: new Map(),
    templatesByRowId: new Map(),
    resolveClientReference,
    callServer,
    fromJSON: (_key, value) => value,
    closed: false,
    closedReason: null,
    currentRowId: undefined,
    lazyWrapperCache,
  };
  response.fromJSON = createModelReviver({
    getChunk: (id) => getChunk(response, id),
    readChunk: (chunk) => readChunk(response, chunk as FlightChunk),
    createLazyChunkWrapper: (chunk) => {
      let wrapper = lazyWrapperCache.get(chunk as FlightChunk);
      if (wrapper === undefined) {
        wrapper = createLazyChunkWrapper(chunk, (payload) =>
          readChunk(response, payload as FlightChunk),
        );
        lazyWrapperCache.set(chunk as FlightChunk, wrapper);
      }
      return wrapper;
    },
    resolveClientReference: (id) => response.resolveClientReference(id),
    callServer,
    getCurrentRowId: () => response.currentRowId,
  });
  return response;
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

export function createFromRowEmitter<T>(options?: FlightClientOptions): {
  push: (row: FlightRowMessage) => void;
  result: Promise<T>;
} {
  const resolveClientReference = createClientReferenceResolver();
  const response = createFlightResponse(resolveClientReference, options?.callServer);
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
          if (Array.isArray(row.templates) && row.templates.length > 0) {
            response.templatesByRowId.set(row.id, row.templates);
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
