import type { ReactNode } from "react";
import { annotateServerReference } from "./references";
import type { FlightServerRenderOptions } from "./types";
import {
  binaryWireTagFromKind,
  flightBinaryRow,
  flightDoneRow,
  flightErrorRow,
  flightModelRow,
  type FlightRowMessage,
  decodeBinaryWireRow,
  decodeWireValue,
  encodeStreamValue,
  escapeStringValue,
  type StreamEncodeContext,
  encodeWireValueWithBinaryRows,
} from "./wire";
import { createClientModuleProxy } from "./references";

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
  return candidate.$$typeof === REACT_ELEMENT_SYMBOL || candidate.$$typeof === LEGACY_REACT_ELEMENT_SYMBOL;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value != null && "then" in value;
}

function encodeFlightRow(id: number, value: unknown): Uint8Array {
  return FLIGHT_ROW_ENCODER.encode(`${id.toString(16)}:${JSON.stringify(value)}\n`);
}

function encodeBinaryFlightRow(id: number, kind: string, bytes: Uint8Array): Uint8Array {
  const tag = binaryWireTagFromKind(kind);
  const prefix = FLIGHT_ROW_ENCODER.encode(`${id.toString(16)}:${tag}${bytes.byteLength.toString(16)},`);
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
}

export type FlightRowEmit = (row: FlightRowMessage, transfer?: Transferable[]) => void;

interface RenderSink {
  readonly settled: boolean;
  emitModelRow: (id: number, value: unknown) => void;
  emitBinaryRow: (id: number, kind: string, bytes: Uint8Array) => void;
}

function createEncodeContext(
  sink: RenderSink,
  queueDeferred: (task: Promise<void>) => void,
): EncodeContext {
  let nextRowId = 1;
  const context: EncodeContext = {
    queueDeferred,
    allocateRowId: () => {
      const current = nextRowId;
      nextRowId += 1;
      return current;
    },
    emitRow: (id, value) => {
      if (sink.settled) return;
      sink.emitModelRow(id, value);
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
          const encoded = await encodeServerNode(value, context);
          context.emitRow(id, encoded);
        })(),
      );
      return id;
    },
    streamEncodeContext: {
      outlineValue: (value) => context.outlineValue(value),
      emitBinaryRow: (kind, bytes) => context.emitBinaryRow(kind, bytes),
      seen: new WeakSet<object>(),
    },
  };
  return context;
}

function encodeElementType(type: unknown): string {
  if (typeof type === "string") {
    return escapeStringValue(type);
  }
  if (type === REACT_FRAGMENT_SYMBOL) {
    return "$Sreact.fragment";
  }
  if (isClientReference(type)) {
    return `$C${type.$$id}`;
  }
  throw new Error("Unsupported element type in minimal runtime.");
}

async function encodeServerNode(value: unknown, context: EncodeContext): Promise<unknown> {
  if (isThenable(value)) {
    const rowId = context.allocateRowId();
    context.queueDeferred(
      (async () => {
        const resolved = await value;
        const encoded = await encodeServerNode(resolved, context);
        context.emitRow(rowId, encoded);
      })(),
    );
    return `$${rowId.toString(16)}`;
  }

  if (Array.isArray(value)) {
    return encodeServerArray(value, context);
  }

  if (!isReactElementLike(value)) {
    return encodeStreamValue(value, context.streamEncodeContext);
  }

  const type = value.type;
  if (typeof type === "function" && !isClientReference(type)) {
    return encodeServerNode(type(value.props), context);
  }
  if (type === REACT_FRAGMENT_SYMBOL) {
    return encodeServerNode(value.props.children, context);
  }

  return encodeServerElement(value, context);
}

async function encodeServerArray(value: unknown[], context: EncodeContext): Promise<unknown[]> {
  const results = new Array(value.length);
  let hasAsync = false;
  for (let i = 0; i < value.length; i += 1) {
    const encoded = encodeServerNode(value[i], context);
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

async function encodeServerElement(
  value: { $$typeof: symbol; type: unknown; props: Record<string, unknown> },
  context: EncodeContext,
): Promise<unknown> {
  const propKeys = Object.keys(value.props);
  const nextProps: Record<string, unknown> = {};
  let hasAsync = false;
  const pendingEntries: Array<[string, PromiseLike<unknown>]> = [];
  for (let i = 0; i < propKeys.length; i += 1) {
    const key = propKeys[i];
    const encoded = encodeServerNode(value.props[key], context);
    if (isThenable(encoded)) {
      hasAsync = true;
      pendingEntries.push([key, encoded]);
    } else {
      nextProps[key] = encoded;
    }
  }
  if (hasAsync) {
    const settled = await Promise.all(pendingEntries.map(([, p]) => p));
    for (let i = 0; i < pendingEntries.length; i += 1) {
      nextProps[pendingEntries[i][0]] = settled[i];
    }
  }
  return [
    "$",
    encodeElementType(value.type),
    value.key == null ? null : String(value.key),
    nextProps,
  ];
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
        const pendingRows = new Set<Promise<void>>();
        const queueDeferred = (task: Promise<void>): void => {
          pendingRows.add(task);
          task.finally(() => {
            pendingRows.delete(task);
          });
        };
        const context = createEncodeContext(
          {
            get settled() {
              return settled;
            },
            emitModelRow(id, value) {
              controller.enqueue(encodeFlightRow(id, value));
            },
            emitBinaryRow(id, kind, bytes) {
              controller.enqueue(encodeBinaryFlightRow(id, kind, bytes));
            },
          },
          queueDeferred,
        );

        const root = await encodeServerNode(element, context);
        if (settled) return;
        controller.enqueue(encodeFlightRow(0, root));

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
    const pendingRows = new Set<Promise<void>>();
    const queueDeferred = (task: Promise<void>): void => {
      pendingRows.add(task);
      task.finally(() => {
        pendingRows.delete(task);
      });
    };
    const context = createEncodeContext(
      {
        get settled() {
          return settled;
        },
        emitModelRow(id, value) {
          emit(flightModelRow(id, value));
        },
        emitBinaryRow(id, kind, bytes) {
          const { row, transfer } = flightBinaryRow(id, kind, bytes);
          emit(row, transfer);
        },
      },
      queueDeferred,
    );

    const root = await encodeServerNode(element, context);
    if (settled) return;
    emit(flightModelRow(0, root));

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
  _options?: Record<string, unknown>,
): Promise<unknown> {
  let source = "null";
  const rowsById = new Map<string, unknown>();
  if (typeof body === "string") {
    source = body;
  } else {
    const pendingRows: Array<Promise<void>> = [];
    for (const [key, value] of body.entries()) {
      if (key === "0") {
        source = value.toString();
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
  return decodeWireValue(parsed, (id) => createClientModuleProxy(id), (id) => rowsById.get(id));
}

export function registerServerReference<T extends (...args: any[]) => any>(
  fn: T,
  id: string,
  _name: string | null = null,
): T {
  const annotated = annotateServerReference(fn, id);
  return annotated as T;
}
