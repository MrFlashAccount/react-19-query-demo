/**
 * Server-side Flight encoding: React tree to wire format.
 *
 * Handles template compaction, encode context, and server node encoding.
 */

import type { FlightRowMessage, StreamEncodeContext } from "./wire";
import { binaryWireTagFromKind, encodeStreamType, encodeStreamValue } from "./wire";
import { CHR, REACT_FRAGMENT_SYMBOL } from "./wire/constants";
import { isClientReference, isReactElementLike } from "./wire/shared";

const FLIGHT_ROW_ENCODER = new TextEncoder();

export function isThenable(value: unknown): value is PromiseLike<unknown> {
  if ((typeof value !== "object" && typeof value !== "function") || value == null) {
    return false;
  }
  return "then" in value;
}

export function encodeFlightRow(id: number, value: unknown): Uint8Array {
  return FLIGHT_ROW_ENCODER.encode(`${id.toString(16)}:${JSON.stringify(value)}\n`);
}

export function encodeBinaryFlightRow(id: number, kind: string, bytes: Uint8Array): Uint8Array {
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

export type FlightRowEmit = (row: FlightRowMessage, transfer?: Transferable[]) => void;

export interface RenderSink {
  readonly settled: boolean;
  emitModelRow: (id: number, value: unknown) => void;
  emitMetadataRow: (id: number, revivePaths: ReadonlyArray<(string | number)[]>) => void;
  emitBinaryRow: (id: number, kind: string, bytes: Uint8Array) => void;
}

export interface CreateEncodeContextOptions {}

export interface EncodeContext {
  queueDeferred: (task: Promise<void>) => void;
  allocateRowId: () => number;
  emitRow: (id: number, value: unknown) => void;
  emitBinaryRow: (kind: string, bytes: Uint8Array) => number;
  outlineValue: (value: unknown) => number;
  streamEncodeContext: StreamEncodeContext;
  preparePathsForEncode: () => void;
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
    context.streamEncodeContext._path = path;
    return encodeStreamValue(value, context.streamEncodeContext);
  }

  const type = value.type;
  if (typeof type === "function" && !isClientReference(type)) {
    const renderedValue = type(value.props);
    return encodeServerNode(renderedValue, context, path);
  }
  if (type === REACT_FRAGMENT_SYMBOL) {
    const children = encodeServerNode(value.props.children, context, [...path, 3, "children"]);
    return children;
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
  value: {
    $$typeof: symbol;
    type: unknown;
    key: string | null;
    props: Record<string, unknown>;
  },
  context: EncodeContext,
  path: (string | number)[] = [],
): unknown {
  const propKeys = Object.keys(value.props);
  const len = propKeys.length;
  const encodedValues: unknown[] = Array.from({ length: len });
  let hasAsync = false;
  const propsPath = [...path, 3];

  for (let i = 0; i < len; i += 1) {
    const v = encodeServerNode(value.props[propKeys[i]], context, [...propsPath, propKeys[i]]);
    encodedValues[i] = v;
    if (!hasAsync && isThenable(v)) hasAsync = true;
  }

  context.streamEncodeContext._path = [...path, 1];
  const type = encodeStreamType(value.type, context.streamEncodeContext);
  const key = value.key;

  if (hasAsync) {
    return Promise.all(encodedValues).then(
      (values) => buildRow(values, len, propKeys, type, key),
      (error) => {
        throw error;
      },
    );
  }

  return buildRow(encodedValues, len, propKeys, type, key);
}

function buildRow(
  vals: unknown[],
  len: number,
  propKeys: string[],
  type: string,
  key: string | null,
) {
  const props: Record<string, unknown> = {};
  for (let i = 0; i < len; i += 1) {
    props[propKeys[i]] = vals[i];
  }
  return [CHR.ELEMENT_PREFIX, type, key, props];
}

/** Structural key for outlineValue deduplication; avoids JSON.stringify for server ref shape. */
function outlineValueKey(value: unknown): string {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 1 && keys[0] === "id") {
      return `\x00id:${String(obj.id)}`;
    }
  }
  return JSON.stringify(value);
}

export function createEncodeContext(
  sink: RenderSink,
  queueDeferred: (task: Promise<void>) => void,
): EncodeContext {
  let nextRowId = 1;
  const outlinedByValue = new Map<string, number>();
  const currentRevivePathsRef: { current: (string | number)[][] } = {
    current: [],
  };
  const context: EncodeContext = {
    queueDeferred,
    allocateRowId: () => {
      const current = nextRowId;
      nextRowId += 1;
      return current;
    },
    emitRow: (id, value) => {
      if (sink.settled) return;

      console.log("emitRow", id, value);

      const paths = currentRevivePathsRef.current;
      if (paths.length > 0) {
        if (typeof value === "string") {
          sink.emitMetadataRow(id, paths);
        } else {
          const nonRootPaths = paths.filter((path) => path.length > 0);
          if (nonRootPaths.length > 0) {
            sink.emitMetadataRow(id, nonRootPaths);
          }
        }
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
      const key = outlineValueKey(value);
      const existing = outlinedByValue.get(key);
      if (existing != null) return existing;
      const id = nextRowId;
      nextRowId += 1;
      outlinedByValue.set(key, id);
      queueDeferred(
        Promise.resolve().then(async () => {
          context.preparePathsForEncode();
          const encoded = encodeServerNode(value, context, []);
          if (isThenable(encoded)) {
            context.emitRow(id, await encoded);
            return;
          }
          context.emitRow(id, encoded);
        }),
      );
      return id;
    },
    streamEncodeContext: {
      outlineValue: (value) => context.outlineValue(value),
      emitBinaryRow: (kind, bytes) => context.emitBinaryRow(kind, bytes),
      seen: new WeakSet<object>(),
      currentRowId: undefined,
      pushReviveValue: (_encoded, path) => {
        currentRevivePathsRef.current.push([...path]);
      },
      _path: [],
    },
    preparePathsForEncode: () => {
      currentRevivePathsRef.current = [];
    },
  };
  return context;
}

export { encodeServerNode };
