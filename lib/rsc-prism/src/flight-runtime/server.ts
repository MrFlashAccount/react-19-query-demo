import type { ReactNode } from "react";
import { annotateServerReference } from "./references";
import type { FlightServerRenderOptions } from "./types";
import {
  flightBinaryRow,
  flightDoneRow,
  flightErrorRow,
  flightMetadataRow,
  flightModelRow,
  pathsToTree,
  type FlightRowMessage,
  type RevivePathTree,
  decodeBinaryWireRow,
  decodeWireValue,
  encodeStreamType,
  encodeStreamValue,
  encodeType,
  encodeWireValueWithBinaryRows,
  type StreamEncodeContext,
} from "./wire";
import { createClientModuleProxy } from "./references";
import type { ComponentTraceTracker, RSCTraceContext } from "../types";

const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
const LEGACY_REACT_ELEMENT_SYMBOL = Symbol.for("react.element");
const REACT_FRAGMENT_SYMBOL = Symbol.for("react.fragment");

function isClientReference(value: unknown): value is { $$typeof: symbol; $$id: string } {
  if (typeof value !== "function" && (typeof value !== "object" || value == null)) {
    return false;
  }
  const candidate = value as { $$typeof?: unknown; $$id?: unknown };
  return candidate.$$typeof === CLIENT_REFERENCE_SYMBOL && typeof candidate.$$id === "string";
}

function isReactElementLike(value: unknown): value is {
  $$typeof: symbol;
  type: unknown;
  key: string | null;
  props: Record<string, unknown>;
} {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  const candidate = value as { $$typeof?: unknown };
  return (
    candidate.$$typeof === REACT_ELEMENT_SYMBOL ||
    candidate.$$typeof === LEGACY_REACT_ELEMENT_SYMBOL
  );
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  if ((typeof value !== "object" && typeof value !== "function") || value == null) {
    return false;
  }
  return "then" in value;
}

interface EncodeContext {
  queueDeferred: (task: Promise<void>) => void;
  allocateRowId: () => number;
  emitRow: (id: number, value: unknown) => void;
  emitBinaryRow: (kind: string, bytes: Uint8Array) => number;
  outlineValue: (value: unknown) => number;
  streamEncodeContext: StreamEncodeContext;
  traceContext: FlightServerRenderOptions["traceContext"];
  componentTrace?: ComponentTraceTracker;
  preparePathsForEncode: () => void;
  useCloneWireFormat?: boolean;
}

export type FlightRowEmit = (row: FlightRowMessage, transfer?: Transferable[]) => void;

interface RenderSink {
  readonly settled: boolean;
  emitModelRow: (id: number, value: unknown) => void;
  emitMetadataRow?: (id: number, revivePathTree: RevivePathTree) => void;
  emitBinaryRow: (id: number, kind: string, bytes: Uint8Array) => void;
}

function createEncodeContext(
  sink: RenderSink,
  queueDeferred: (task: Promise<void>) => void,
  options?: FlightServerRenderOptions & { useRawForCloneableTypes?: boolean },
): EncodeContext {
  let nextRowId = 1;
  const currentRevivePathsRef: { current: (string | number)[][] } = { current: [] };
  const componentTrace = options?.componentTrace;
  const context: EncodeContext = {
    queueDeferred,
    allocateRowId: () => {
      const current = nextRowId;
      nextRowId += 1;
      return current;
    },
    emitRow: (id, value) => {
      if (sink.settled) return;
      const paths = currentRevivePathsRef.current;
      if (
        paths.length > 0 &&
        sink.emitMetadataRow &&
        options?.useRawForCloneableTypes !== true
      ) {
        sink.emitMetadataRow(id, pathsToTree(paths));
      }
      sink.emitModelRow(id, value);
      currentRevivePathsRef.current = [];
    },
    emitBinaryRow: (kind, bytes) => {
      const id = nextRowId;
      nextRowId += 1;
      if (!sink.settled) {
        sink.emitBinaryRow(id, kind, bytes);
      }
      return id;
    },
    outlineValue: (value) => {
      const id = nextRowId;
      nextRowId += 1;
      queueDeferred(
        (async () => {
          context.preparePathsForEncode();
          const encoded = encodeServerNode(value, context, []);
          if (isThenable(encoded)) {
            context.emitRow(id, await encoded);
            return;
          }
          context.emitRow(id, encoded);
        })(),
      );
      return id;
    },
    streamEncodeContext: {
      outlineValue: (value) => context.outlineValue(value),
      emitBinaryRow: (kind, bytes) => context.emitBinaryRow(kind, bytes),
      seen: new WeakSet<object>(),
      traceContext: options?.traceContext,
      componentTrace,
      currentRowId: undefined,
      useRawForCloneableTypes: options?.useRawForCloneableTypes,
      pushReviveValue: (_encoded, path) => {
        currentRevivePathsRef.current.push([...path]);
      },
    },
    traceContext: options?.traceContext,
    componentTrace,
    preparePathsForEncode: () => {
      currentRevivePathsRef.current = [];
    },
    useCloneWireFormat: options?.useRawForCloneableTypes === true,
  };
  return context;
}

function encodeServerNode(
  value: unknown,
  context: EncodeContext,
  path: (string | number)[] = [],
): unknown {
  const useCloneWire = context.useCloneWireFormat === true;

  if (isThenable(value)) {
    const rowId = context.allocateRowId();
    context.queueDeferred(
      (async () => {
        context.preparePathsForEncode();
        const resolved = await value;
        const encoded = encodeServerNode(resolved, context, []);
        if (isThenable(encoded)) {
          context.emitRow(rowId, await encoded);
          return;
        }
        context.emitRow(rowId, encoded);
      })(),
    );
    return useCloneWire ? { $t: "rowRef", id: rowId } : `$${rowId.toString(16)}`;
  }

  if (Array.isArray(value)) {
    return encodeServerArray(value, context, path);
  }

  if (!isReactElementLike(value)) {
    if (useCloneWire) {
      const seen = new WeakSet<object>();
      return encodeWireValueWithBinaryRows(
        value,
        (kind, bytes) => context.emitBinaryRow(kind, bytes),
        seen,
        { useRawForCloneableTypes: true },
      );
    }
    const streamCtx = {
      ...context.streamEncodeContext,
      _path: path,
    };
    return encodeStreamValue(value, streamCtx);
  }

  const type = value.type;
  if (typeof type === "function" && !isClientReference(type)) {
    const renderedValue = type(value.props);
    if (isThenable(renderedValue)) {
      return renderedValue.then(
        (resolvedValue) => encodeServerNode(resolvedValue, context, path),
        (error) => {
          throw error;
        },
      );
    }
    return encodeServerNode(renderedValue, context, path);
  }
  if (type === REACT_FRAGMENT_SYMBOL) {
    return encodeServerNode(value.props.children, context, [...path, 3, "children"]);
  }

  return encodeServerElement(value, context, path);
}

function encodeServerArray(
  value: unknown[],
  context: EncodeContext,
  path: (string | number)[] = [],
) {
  const results = Array.from({ length: value.length });
  let hasAsync = false;
  for (let i = 0; i < value.length; i += 1) {
    const encoded = encodeServerNode(value[i], context, [...path, i]);
    results[i] = encoded;
    if (!hasAsync && isThenable(encoded)) {
      hasAsync = true;
    }
  }
  if (!hasAsync) {
    return results;
  }
  return Promise.all(results);
}

function encodeServerElement(
  value: { $$typeof: symbol; type: unknown; key: string | null; props: Record<string, unknown> },
  context: EncodeContext,
  path: (string | number)[] = [],
): unknown {
  const propKeys = Object.keys(value.props);
  const len = propKeys.length;
  const encoded: unknown[] = Array.from({ length: len });
  let hasAsync = false;
  const propsPath = [...path, 3];

  for (let i = 0; i < len; i += 1) {
    const v = encodeServerNode(value.props[propKeys[i]], context, [...propsPath, propKeys[i]]);
    encoded[i] = v;
    if (!hasAsync && isThenable(v)) hasAsync = true;
  }

  const useCloneWire = context.useCloneWireFormat === true;
  const ty = useCloneWire ? encodeType(value.type) : encodeStreamType(value.type, {
    ...context.streamEncodeContext,
    _path: [...path, 1],
  });
  const key = value.key == null ? null : String(value.key);

  const buildRow = (vals: unknown[]) => {
    const props: Record<string, unknown> = {};
    for (let i = 0; i < len; i += 1) props[propKeys[i]] = vals[i];
    return useCloneWire ? { $t: "element", ty, props, key } : (["$", ty, key, props] as unknown);
  };

  if (hasAsync) {
    return Promise.all(encoded).then(
      (values) => buildRow(values),
      (error) => {
        throw error;
      },
    );
  }

  return buildRow(encoded);
}

const UNSUPPORTED_STREAM_MESSAGE =
  "[rsc-prism] HTTP text Flight stream is not supported. Use renderToRowEmitter instead.";

export async function renderToReadableStream(
  _element: ReactNode,
  _moduleBasePath: unknown,
  _options?: FlightServerRenderOptions,
): Promise<ReadableStream<Uint8Array>> {
  throw new Error(UNSUPPORTED_STREAM_MESSAGE);
}

export async function renderToRowEmitter(
  element: ReactNode,
  _moduleBasePath: unknown,
  emit: FlightRowEmit,
  options?: FlightServerRenderOptions,
): Promise<void> {
  const signal = options?.signal;
  if (signal?.aborted) {
    emit(flightErrorRow(String(signal.reason)));
    return;
  }

  let settled = false;
  const onAbort = () => {
    if (settled) return;
    settled = true;
    emit(flightErrorRow(String(signal?.reason)));
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    let queuedDeferredRows = 0;
    let emittedModelRows = 0;
    let emittedBinaryRows = 0;

    const pendingRows = new Set<Promise<void>>();
    const queueDeferred = (task: Promise<void>): void => {
      queuedDeferredRows += 1;
      pendingRows.add(task);
      void task.finally(() => {
        pendingRows.delete(task);
      });
    };
    const context = createEncodeContext(
      {
        get settled() {
          return settled;
        },
        emitModelRow(id, value) {
          emittedModelRows += 1;
          emit(flightModelRow(id, value));
        },
        emitMetadataRow(id, revivePaths) {
          emit(flightMetadataRow(id, revivePaths));
        },
        emitBinaryRow(id, kind, bytes) {
          emittedBinaryRows += 1;
          const { row, transfer } = flightBinaryRow(id, kind, bytes);
          emit(row, transfer);
        },
      },
      queueDeferred,
      { ...options, useRawForCloneableTypes: true },
    );

    context.preparePathsForEncode();
    const rootEncoded = encodeServerNode(element, context);
    const root = isThenable(rootEncoded) ? await rootEncoded : rootEncoded;
    if (settled) return;
    context.emitRow(0, root);

    while (pendingRows.size > 0) {
      await Promise.race(pendingRows);
      if (settled) return;
    }

    emit(flightDoneRow());
    settled = true;
  } catch (error) {
    if (!settled) {
      settled = true;
      const message = error instanceof Error ? error.message : String(error);
      emit(flightErrorRow(message));
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function decodeReply(
  body: FormData | string,
  _moduleBasePath: unknown,
  options?: {
    traceContext?: RSCTraceContext;
    componentTrace?: ComponentTraceTracker;
    currentRowId?: number;
  },
): Promise<unknown> {
  let source = "null";
  const rowsById = new Map<number, unknown>();
  if (typeof body === "string") {
    source = body;
  } else {
    const pendingRows: Array<Promise<void>> = [];
    for (const [key, value] of body.entries()) {
      if (key === "0") {
        source = typeof value === "string" ? value : "";
        continue;
      }
      const separatorIndex = key.indexOf(":");
      if (separatorIndex === -1) {
        continue;
      }
      const rowId = Number.parseInt(key.slice(0, separatorIndex), 10);
      const rowTag = key.slice(separatorIndex + 1);
      if (
        Number.isFinite(rowId) &&
        ((typeof File !== "undefined" && value instanceof File) ||
          (typeof Blob !== "undefined" && value instanceof Blob))
      ) {
        pendingRows.push(
          value.arrayBuffer().then((arrayBuffer) => {
            rowsById.set(rowId, decodeBinaryWireRow(rowTag, new Uint8Array(arrayBuffer)));
          }),
        );
      }
    }
    if (pendingRows.length > 0) {
      await Promise.all(pendingRows);
    }
  }
  const parsed = JSON.parse(source);
  return decodeWireValue(
    parsed,
    (id) => createClientModuleProxy(id),
    (id) => rowsById.get(typeof id === "number" ? id : Number(id)),
    undefined,
    options,
  );
}

export function registerServerReference<T extends (...args: any[]) => any>(
  fn: T,
  id: string,
  _name: string | null = null,
): T {
  const annotated = annotateServerReference(fn, id);
  return annotated as T;
}
