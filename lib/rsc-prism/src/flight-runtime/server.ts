import type { ReactNode } from "react";
import { annotateServerReference } from "./references";
import type { FlightServerRenderOptions } from "./types";
import {
  binaryWireTagFromKind,
  flightBinaryRow,
  flightDoneRow,
  flightErrorRow,
  flightMetadataRow,
  flightModelRow,
  type FlightRowMessage,
  decodeBinaryWireRow,
  decodeWireValue,
  encodeStreamType,
  encodeStreamValue,
  type StreamEncodeContext,
} from "./wire";
import { createClientModuleProxy } from "./references";
import {
  createComponentTraceTracker,
  endComponentPhaseSpan,
  startComponentPhaseSpan,
  summarizeProps,
  type ComponentTraceTracker,
} from "../tracing";
import type { RSCTraceContext } from "../tracing";

const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
const LEGACY_REACT_ELEMENT_SYMBOL = Symbol.for("react.element");
const REACT_FRAGMENT_SYMBOL = Symbol.for("react.fragment");
const FLIGHT_ROW_ENCODER = new TextEncoder();

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

function encodeFlightRow(id: number, value: unknown): Uint8Array {
  return FLIGHT_ROW_ENCODER.encode(`${id.toString(16)}:${JSON.stringify(value)}\n`);
}

function encodeMetadataFlightRow(id: number, revivePaths: (string | number)[][]): Uint8Array {
  return FLIGHT_ROW_ENCODER.encode(`M${id.toString(16)}:${JSON.stringify({ revivePaths })}\n`);
}

function encodeBinaryFlightRow(id: number, kind: string, bytes: Uint8Array): Uint8Array {
  const tag = binaryWireTagFromKind(kind);
  const prefix = FLIGHT_ROW_ENCODER.encode(
    `${id.toString(16)}:${tag}${bytes.byteLength.toString(16)},`,
  );
  const output = new Uint8Array(prefix.byteLength + bytes.byteLength + 1);
  output.set(prefix, 0);
  output.set(bytes, prefix.byteLength);
  output[output.length - 1] = 10;
  return output;
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
}

export type FlightRowEmit = (row: FlightRowMessage, transfer?: Transferable[]) => void;

interface RenderSink {
  readonly settled: boolean;
  emitModelRow: (id: number, value: unknown) => void;
  emitMetadataRow?: (id: number, revivePaths: (string | number)[][]) => void;
  emitBinaryRow: (id: number, kind: string, bytes: Uint8Array) => void;
}

function createEncodeContext(
  sink: RenderSink,
  queueDeferred: (task: Promise<void>) => void,
  options?: FlightServerRenderOptions & { useRawForCloneableTypes?: boolean },
): EncodeContext {
  let nextRowId = 1;
  const currentPathsRef: { current: (string | number)[][] } = { current: [] };
  const componentTrace =
    options?.componentTrace ??
    (options?.traceContext != null
      ? createComponentTraceTracker({
          requestId: options.traceContext.requestId,
          actionId: options.traceContext.actionId,
          parentSpan: options.traceContext.parentSpan,
        })
      : undefined);
  const context: EncodeContext = {
    queueDeferred,
    allocateRowId: () => {
      const current = nextRowId;
      nextRowId += 1;
      return current;
    },
    emitRow: (id, value) => {
      if (sink.settled) return;
      const paths = currentPathsRef.current;
      if (paths.length > 0 && sink.emitMetadataRow) {
        sink.emitMetadataRow(id, paths);
      }
      sink.emitModelRow(id, value);
      currentPathsRef.current = [];
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
      collectRevivePaths: (path, _kind) => currentPathsRef.current.push(path),
    },
    traceContext: options?.traceContext,
    componentTrace,
    preparePathsForEncode: () => {
      currentPathsRef.current = [];
    },
  };
  return context;
}

function describeComponentType(type: unknown): {
  componentKind: string;
  componentName: string;
  hostTag?: string;
} {
  if (typeof type === "string") {
    return {
      componentKind: "host",
      componentName: type,
      hostTag: type,
    };
  }
  if (type === REACT_FRAGMENT_SYMBOL) {
    return {
      componentKind: "fragment",
      componentName: "Fragment",
    };
  }
  if (isClientReference(type)) {
    return {
      componentKind: "client",
      componentName: type.$$id,
    };
  }
  if (typeof type === "function") {
    return {
      componentKind: "function",
      componentName: type.name || "Anonymous",
    };
  }
  return {
    componentKind: "unknown",
    componentName: String(type),
  };
}

function encodeServerNode(
  value: unknown,
  context: EncodeContext,
  path: (string | number)[] = [],
): unknown {
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
    return `$${rowId.toString(16)}`;
  }

  if (Array.isArray(value)) {
    return encodeServerArray(value, context, path);
  }

  if (!isReactElementLike(value)) {
    const streamCtx = {
      ...context.streamEncodeContext,
      _path: path,
    };
    return encodeStreamValue(value, streamCtx);
  }

  const type = value.type;
  if (typeof type === "function" && !isClientReference(type)) {
    const componentInfo = describeComponentType(type);
    const renderSpan = startComponentPhaseSpan(context.componentTrace, "render", {
      ...componentInfo,
      source: "server",
      mode: "stream",
      ...summarizeProps(value.props),
    });
    try {
      const renderedValue = type(value.props);
      if (isThenable(renderedValue)) {
        return renderedValue.then(
          (resolvedValue) => {
            endComponentPhaseSpan(context.componentTrace, renderSpan.span);
            return encodeServerNode(resolvedValue, context, path);
          },
          (error) => {
            endComponentPhaseSpan(context.componentTrace, renderSpan.span, error);
            throw error;
          },
        );
      }
      endComponentPhaseSpan(context.componentTrace, renderSpan.span);
      return encodeServerNode(renderedValue, context, path);
    } catch (error) {
      endComponentPhaseSpan(context.componentTrace, renderSpan.span, error);
      throw error;
    }
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
  const componentInfo = describeComponentType(value.type);
  const encodeSpan = startComponentPhaseSpan(context.componentTrace, "encode", {
    ...componentInfo,
    source: "server",
    mode: "stream",
    ...summarizeProps(value.props),
  });
  try {
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

    const typeCtx = {
      ...context.streamEncodeContext,
      _path: [...path, 1],
    };
    const type = encodeStreamType(value.type, typeCtx);
    const key = value.key == null ? null : String(value.key);

    const buildRow = (vals: unknown[]) => {
      const props: Record<string, unknown> = {};
      for (let i = 0; i < len; i += 1) props[propKeys[i]] = vals[i];
      endComponentPhaseSpan(context.componentTrace, encodeSpan.span, undefined, {
        propsKeyCount: len,
      });
      return ["$", type, key, props];
    };

    if (hasAsync) {
      return Promise.all(encoded).then(
        (values) => buildRow(values),
        (error) => {
          endComponentPhaseSpan(context.componentTrace, encodeSpan.span, error);
          throw error;
        },
      );
    }

    return buildRow(encoded);
  } catch (error) {
    endComponentPhaseSpan(context.componentTrace, encodeSpan.span, error);
    throw error;
  }
}

export async function renderToReadableStream(
  element: ReactNode,
  _moduleBasePath: unknown,
  options?: FlightServerRenderOptions,
): Promise<ReadableStream<Uint8Array>> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const signal = options?.signal;
      if (signal?.aborted) {
        controller.error(signal.reason);
        return;
      }

      let settled = false;
      const onAbort = () => {
        if (settled) return;
        settled = true;
        controller.error(signal?.reason);
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
              controller.enqueue(encodeFlightRow(id, value));
            },
            emitMetadataRow(id, revivePaths) {
              controller.enqueue(encodeMetadataFlightRow(id, revivePaths));
            },
            emitBinaryRow(id, kind, bytes) {
              emittedBinaryRows += 1;
              controller.enqueue(encodeBinaryFlightRow(id, kind, bytes));
            },
          },
          queueDeferred,
          options,
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

        controller.close();
        settled = true;
      } catch (error) {
        if (!settled) {
          settled = true;
          controller.error(error);
        }
      } finally {
        signal?.removeEventListener("abort", onAbort);
      }
    },
  });
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
  const rowsById = new Map<string, unknown>();
  if (typeof body === "string") {
    source = body;
  } else {
    const pendingRows: Array<Promise<void>> = [];
    for (const [key, value] of body.entries()) {
      if (key === "0") {
        source = typeof value === "string" ? value : "";
        continue;
      }
      const separatorIndex = key.lastIndexOf(":");
      if (separatorIndex === -1) {
        continue;
      }
      const rowTag = key.slice(separatorIndex + 1);
      if (
        (typeof File !== "undefined" && value instanceof File) ||
        (typeof Blob !== "undefined" && value instanceof Blob)
      ) {
        pendingRows.push(
          value.arrayBuffer().then((arrayBuffer) => {
            rowsById.set(key, decodeBinaryWireRow(rowTag, new Uint8Array(arrayBuffer)));
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
    (id) => rowsById.get(id),
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
