import { Fragment, isValidElement } from "react";
import {
  createComponentTraceTracker,
  endComponentPhaseSpan,
  startComponentPhaseSpan,
  summarizeProps,
  type ComponentTraceTracker,
  type RSCTraceContext,
} from "../tracing";

const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
const SERVER_REFERENCE_SYMBOL = Symbol.for("react.server.reference");
const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
const LEGACY_REACT_ELEMENT_SYMBOL = Symbol.for("react.element");
const REACT_FRAGMENT_SYMBOL = Symbol.for("react.fragment");
const REACT_LAZY_SYMBOL = Symbol.for("react.lazy");

type JsonObject = Record<string, unknown>;
const EMPTY_ARRAY: unknown[] = [];

type EmitBinaryRow = (kind: string, bytes: Uint8Array) => string | number;
type StreamEmitBinaryRow = (kind: string, bytes: Uint8Array) => number;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeTypedArray(value: unknown): { kind: string; bytes: Uint8Array } | null {
  const toBytes = (buffer: ArrayBufferLike, byteOffset: number, byteLength: number): Uint8Array =>
    new Uint8Array(buffer, byteOffset, byteLength);

  if (value instanceof Uint8Array) return { kind: "Uint8Array", bytes: value };
  if (value instanceof Int8Array)
    return { kind: "Int8Array", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  if (value instanceof Uint8ClampedArray)
    return {
      kind: "Uint8ClampedArray",
      bytes: toBytes(value.buffer, value.byteOffset, value.byteLength),
    };
  if (value instanceof Int16Array)
    return { kind: "Int16Array", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  if (value instanceof Uint16Array)
    return {
      kind: "Uint16Array",
      bytes: toBytes(value.buffer, value.byteOffset, value.byteLength),
    };
  if (value instanceof Int32Array)
    return { kind: "Int32Array", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  if (value instanceof Uint32Array)
    return {
      kind: "Uint32Array",
      bytes: toBytes(value.buffer, value.byteOffset, value.byteLength),
    };
  if (value instanceof Float32Array)
    return {
      kind: "Float32Array",
      bytes: toBytes(value.buffer, value.byteOffset, value.byteLength),
    };
  if (value instanceof Float64Array)
    return {
      kind: "Float64Array",
      bytes: toBytes(value.buffer, value.byteOffset, value.byteLength),
    };
  if (value instanceof BigInt64Array)
    return {
      kind: "BigInt64Array",
      bytes: toBytes(value.buffer, value.byteOffset, value.byteLength),
    };
  if (value instanceof BigUint64Array)
    return {
      kind: "BigUint64Array",
      bytes: toBytes(value.buffer, value.byteOffset, value.byteLength),
    };
  if (value instanceof DataView)
    return { kind: "DataView", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  return null;
}

function parseHexChunkId(raw: string): number {
  const id = Number.parseInt(raw, 16);
  if (!Number.isFinite(id) || id < 0) {
    throw new Error(`[rsc-prism] Invalid chunk id "${raw}" in Flight payload.`);
  }
  return id;
}

function toArrayBuffer(
  buffer: ArrayBufferLike,
  byteOffset: number = 0,
  byteLength: number = buffer.byteLength - byteOffset,
): ArrayBuffer {
  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }
  const copied = new Uint8Array(byteLength);
  copied.set(new Uint8Array(buffer, byteOffset, byteLength));
  return copied.buffer;
}

export function rehydrateTypedArray(kind: string, bytes: Uint8Array): unknown {
  const toCopiedBuffer = (): ArrayBuffer =>
    toArrayBuffer(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const canUseView = (alignment: number): boolean =>
    bytes.byteOffset % alignment === 0 && bytes.byteLength % alignment === 0;
  switch (kind) {
    case "Uint8Array":
      return bytes;
    case "Int8Array":
      return new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    case "Uint8ClampedArray":
      return new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    case "Int16Array":
      if (canUseView(2)) {
        return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      }
      return new Int16Array(toCopiedBuffer());
    case "Uint16Array":
      if (canUseView(2)) {
        return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      }
      return new Uint16Array(toCopiedBuffer());
    case "Int32Array":
      if (canUseView(4)) {
        return new Int32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      }
      return new Int32Array(toCopiedBuffer());
    case "Uint32Array":
      if (canUseView(4)) {
        return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      }
      return new Uint32Array(toCopiedBuffer());
    case "Float32Array":
      if (canUseView(4)) {
        return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      }
      return new Float32Array(toCopiedBuffer());
    case "Float64Array":
      if (canUseView(8)) {
        return new Float64Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 8);
      }
      return new Float64Array(toCopiedBuffer());
    case "BigInt64Array":
      if (canUseView(8)) {
        return new BigInt64Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 8);
      }
      return new BigInt64Array(toCopiedBuffer());
    case "BigUint64Array":
      if (canUseView(8)) {
        return new BigUint64Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 8);
      }
      return new BigUint64Array(toCopiedBuffer());
    case "DataView":
      return new DataView(toCopiedBuffer());
    default:
      throw new Error(`Unsupported typed array kind "${kind}"`);
  }
}

export function rehydrateArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer;
  }
  return toArrayBuffer(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function isReactElementLike(value: unknown): value is {
  $$typeof: symbol;
  type: unknown;
  key: string | null;
  props: Record<string, unknown>;
} {
  if (!isValidElement(value)) {
    return false;
  }
  const candidate = value as { $$typeof?: unknown };
  return (
    candidate.$$typeof === REACT_ELEMENT_SYMBOL ||
    candidate.$$typeof === LEGACY_REACT_ELEMENT_SYMBOL
  );
}

function isClientReference(value: unknown): value is { $$typeof: symbol; $$id: string } {
  if (typeof value !== "function" && (typeof value !== "object" || value == null)) {
    return false;
  }
  const candidate = value as { $$typeof?: unknown; $$id?: unknown };
  return candidate.$$typeof === CLIENT_REFERENCE_SYMBOL && typeof candidate.$$id === "string";
}

function isServerReference(value: unknown): value is { $$typeof: symbol; $$id: string } {
  if (typeof value !== "function" && (typeof value !== "object" || value == null)) {
    return false;
  }
  const candidate = value as { $$typeof?: unknown; $$id?: unknown };
  return candidate.$$typeof === SERVER_REFERENCE_SYMBOL && typeof candidate.$$id === "string";
}

function encodeType(value: unknown): JsonObject {
  if (typeof value === "string") {
    return { $t: "host", v: value };
  }
  if (value === REACT_FRAGMENT_SYMBOL || value === Fragment) {
    return { $t: "fragment" };
  }
  if (isClientReference(value)) {
    return { $t: "client", id: value.$$id };
  }
  throw new Error("Unsupported element type in minimal runtime.");
}

export function encodeStreamType(value: unknown, context?: StreamEncodeContext): string {
  if (typeof value === "string") {
    return escapeStringValue(value);
  }
  if (value === REACT_FRAGMENT_SYMBOL || value === Fragment) {
    return context ? emitRevivable(context, "$Sreact.fragment") : "$Sreact.fragment";
  }
  if (isClientReference(value)) {
    return context ? emitRevivable(context, `$C${value.$$id}`) : `$C${value.$$id}`;
  }
  throw new Error("Unsupported element type in minimal runtime.");
}

function resolveComponentName(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "function") {
    return value.name || "Anonymous";
  }
  if (value === REACT_FRAGMENT_SYMBOL || value === Fragment) {
    return "Fragment";
  }
  if (isClientReference(value)) {
    return value.$$id;
  }
  return String(value);
}

function describeComponentType(value: unknown): {
  componentKind: string;
  componentName: string;
  hostTag?: string;
} {
  if (typeof value === "string") {
    return {
      componentKind: "host",
      componentName: value,
      hostTag: value,
    };
  }
  if (value === REACT_FRAGMENT_SYMBOL || value === Fragment) {
    return {
      componentKind: "fragment",
      componentName: "Fragment",
    };
  }
  if (isClientReference(value)) {
    return {
      componentKind: "client",
      componentName: value.$$id,
    };
  }
  if (typeof value === "function") {
    return {
      componentKind: "function",
      componentName: value.name || "Anonymous",
    };
  }
  return {
    componentKind: "unknown",
    componentName: resolveComponentName(value),
  };
}

function decodeType(value: JsonObject, resolveClientReference: (id: string) => unknown): unknown {
  switch (value.$t) {
    case "host":
      return value.v as string;
    case "fragment":
      return Fragment;
    case "client":
      return resolveClientReference(value.id as string);
    default:
      throw new Error(`Unsupported encoded element type "${String(value.$t)}"`);
  }
}

export interface StreamEncodeContext {
  outlineValue: (value: unknown) => number;
  emitBinaryRow: StreamEmitBinaryRow;
  seen: WeakSet<object>;
  traceContext?: RSCTraceContext;
  componentTrace?: ComponentTraceTracker;
  currentRowId?: number;
  /** When true (row/postMessage path), send raw Date, BigInt, -0, NaN, Infinity for structured clone */
  useRawForCloneableTypes?: boolean;
  /** Optional: collect path for inline revival; client uses paths for direct replacement */
  pushReviveValue?: (encoded: string, path: (string | number)[]) => void;
  /** Current path (set by caller for path collection) */
  _path?: (string | number)[];
}

export function escapeStringValue(str: string): string {
  return str.length > 0 && str.charCodeAt(0) === 36 ? `$${str}` : str;
}

function emitRevivable(context: StreamEncodeContext, encoded: string): string {
  const path = context._path ?? [];
  context.pushReviveValue?.(encoded, path);
  return encoded;
}

function encodeStreamValueInternal(value: unknown, context: StreamEncodeContext): unknown {
  if (value === undefined) {
    if (context.useRawForCloneableTypes) return undefined;
    return emitRevivable(context, "$undefined");
  }
  if (typeof value === "string") {
    return escapeStringValue(value);
  }
  if (typeof value === "number") {
    if (context.useRawForCloneableTypes) return value;
    if (Number.isNaN(value)) return emitRevivable(context, "$NaN");
    if (!Number.isFinite(value)) return value < 0 ? "$-Infinity" : "$Infinity";
    if (Object.is(value, -0)) return emitRevivable(context, "$-0");
    return value;
  }
  if (typeof value === "boolean" || value == null) {
    return value;
  }
  if (typeof value === "bigint") {
    if (context.useRawForCloneableTypes) return value;
    return emitRevivable(context, `$n${value.toString()}`);
  }
  if (typeof value === "symbol") {
    const key = Symbol.keyFor(value);
    if (key == null) {
      throw new Error("Only global symbols are supported by the minimal Flight runtime.");
    }
    return emitRevivable(context, `$S${key}`);
  }
  if (typeof value === "function") {
    if (isClientReference(value)) {
      return emitRevivable(context, `$C${value.$$id}`);
    }
    if (isServerReference(value)) {
      const outlinedId = context.outlineValue({ id: value.$$id });
      return emitRevivable(context, `$F${outlinedId.toString(16)}`);
    }
    throw new Error("Functions are not supported by the minimal Flight runtime.");
  }

  if (context.seen.has(value as object)) {
    throw new Error("Circular structures are not supported by the minimal Flight runtime.");
  }
  context.seen.add(value as object);

  if (value instanceof Date) {
    if (context.useRawForCloneableTypes) return value;
    return emitRevivable(context, `$D${value.toJSON()}`);
  }
  if (value instanceof URLSearchParams) {
    return emitRevivable(context, `$P${value.toString()}`);
  }
  if (value instanceof FormData) {
    const entries: Array<[string, unknown]> = [];
    for (const [key, item] of value.entries()) {
      if (
        (typeof File !== "undefined" && item instanceof File) ||
        (typeof Blob !== "undefined" && item instanceof Blob)
      ) {
        throw new Error(
          "File and Blob FormData values are not supported by the minimal Flight runtime.",
        );
      }
      entries.push([key, item]);
    }
    const outlinedId = context.outlineValue(entries);
    return emitRevivable(context, `$K${outlinedId.toString(16)}`);
  }
  if (value instanceof Map) {
    if (context.useRawForCloneableTypes) {
      return new Map(
        Array.from(value.entries()).map(([k, v]) => [
          encodeStreamValueInternal(k, context),
          encodeStreamValueInternal(v, context),
        ]),
      );
    }
    const outlinedId = context.outlineValue(Array.from(value.entries()));
    return emitRevivable(context, `$Q${outlinedId.toString(16)}`);
  }
  if (value instanceof Set) {
    if (context.useRawForCloneableTypes) {
      return new Set(
        Array.from(value.values()).map((v) => encodeStreamValueInternal(v, context)),
      );
    }
    const outlinedId = context.outlineValue(Array.from(value.values()));
    return emitRevivable(context, `$W${outlinedId.toString(16)}`);
  }
  if (value instanceof ArrayBuffer) {
    const id = context.emitBinaryRow("ArrayBuffer", new Uint8Array(value));
    return emitRevivable(context, `$${id.toString(16)}`);
  }
  const typed = normalizeTypedArray(value);
  if (typed != null) {
    const id = context.emitBinaryRow(typed.kind, typed.bytes);
    return emitRevivable(context, `$${id.toString(16)}`);
  }
  if (Array.isArray(value)) {
    const basePath = context._path ?? [];
    return Array.from({ length: value.length }, (_, i) =>
      encodeStreamValueInternal(value[i], { ...context, _path: [...basePath, i] }),
    );
  }
  if (isReactElementLike(value)) {
    const tracker =
      context.componentTrace ??
      (context.traceContext != null
        ? createComponentTraceTracker({
            requestId: context.traceContext.requestId,
            actionId: context.traceContext.actionId,
            parentSpan: context.traceContext.parentSpan,
          })
        : undefined);
    const componentInfo = describeComponentType(value.type);
    const encodeSpan = startComponentPhaseSpan(tracker, "encode", {
      ...componentInfo,
      rowId: context.currentRowId,
      source: context.traceContext?.source ?? "transport",
      mode: "stream",
      ...summarizeProps(value.props),
    });
    try {
      const basePath = context._path ?? [];
      const type = encodeStreamType(value.type, { ...context, _path: [...basePath, 1] });
      const key = value.key == null ? null : String(value.key);
      const props = encodeStreamValueInternal(value.props, {
        ...context,
        componentTrace: tracker,
        _path: [...basePath, 3],
      });
      endComponentPhaseSpan(tracker, encodeSpan.span);
      return ["$", type, key, props];
    } catch (error) {
      endComponentPhaseSpan(tracker, encodeSpan.span, error);
      throw error;
    }
  }
  if (isClientReference(value)) {
    return emitRevivable(context, `$C${value.$$id}`);
  }
  if (isServerReference(value)) {
    const outlinedId = context.outlineValue({ id: value.$$id });
    return emitRevivable(context, `$F${outlinedId.toString(16)}`);
  }
  if (!isPlainObject(value)) {
    throw new Error("Only plain objects are serializable by the minimal Flight runtime.");
  }

  const result: Record<string, unknown> = {};
  const basePath = context._path ?? [];
  for (const [key, item] of Object.entries(value)) {
    result[key] = encodeStreamValueInternal(item, { ...context, _path: [...basePath, key] });
  }
  return result;
}

export function encodeStreamValue(value: unknown, context: StreamEncodeContext): unknown {
  return encodeStreamValueInternal(value, context);
}

export interface StreamDecodeContext<Chunk = unknown> {
  getChunk: (id: number) => Chunk;
  readChunk: (chunk: Chunk) => unknown;
  createLazyChunkWrapper: (chunk: Chunk) => unknown;
  resolveClientReference: (id: string) => unknown;
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>;
  traceContext?: RSCTraceContext;
  componentTrace?: ComponentTraceTracker;
  getCurrentRowId?: () => number | undefined;
}

function decodeFromOutlinedEntries<Chunk>(
  context: StreamDecodeContext<Chunk>,
  prefix: string,
  raw: string,
): unknown[] {
  const id = parseHexChunkId(raw.slice(prefix.length));
  const chunk = context.getChunk(id);
  return context.readChunk(chunk) as unknown[];
}

function decodeFormDataFromChunk<Chunk>(
  context: StreamDecodeContext<Chunk>,
  raw: string,
): FormData {
  const entries = decodeFromOutlinedEntries(context, "$K", raw);
  const form = new FormData();
  for (let i = 0; i < entries.length; i += 1) {
    const tuple = entries[i] as unknown[];
    const key = tuple?.[0];
    const value = tuple?.[1];
    form.append(
      typeof key === "string" ? key : String(key),
      typeof value === "string" ? value : String(value),
    );
  }
  return form;
}

function decodeServerReferenceFromChunk<Chunk>(
  context: StreamDecodeContext<Chunk>,
  raw: string,
): {
  (...args: unknown[]): Promise<unknown>;
  $$typeof: symbol;
  $$id: string;
  $$bound: null;
} {
  const id = parseHexChunkId(raw.slice(2));
  const chunk = context.getChunk(id);
  const value = context.readChunk(chunk) as { id?: unknown } | null;
  const referenceId = value != null && typeof value.id === "string" ? value.id : "";
  return createServerReference(referenceId, context.callServer);
}

function createServerReference(
  id: string,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
): {
  (...args: unknown[]): Promise<unknown>;
  $$typeof: symbol;
  $$id: string;
  $$bound: null;
} {
  const reference = async (...args: unknown[]) => {
    if (callServer == null) {
      throw new Error(`[rsc-prism] Missing callServer implementation for server action "${id}".`);
    }
    return callServer(id, args);
  };
  const taggedReference = reference as typeof reference & {
    $$typeof: symbol;
    $$id: string;
    $$bound: null;
  };
  taggedReference.$$typeof = SERVER_REFERENCE_SYMBOL;
  taggedReference.$$id = id;
  taggedReference.$$bound = null;
  return taggedReference;
}

export function parseModelString<Chunk>(
  context: StreamDecodeContext<Chunk>,
  value: string,
): unknown {
  if (value.length === 0 || value.charCodeAt(0) !== 36) {
    return value;
  }
  if (value === "$undefined") {
    return undefined;
  }
  if (value.length === 1) {
    return value;
  }
  switch (value.charCodeAt(1)) {
    case 36:
      return value.slice(1);
    case 117:
      return undefined;
    case 110:
      return BigInt(value.slice(2));
    case 68:
      return new Date(value.slice(2));
    case 80:
      return new URLSearchParams(value.slice(2));
    case 83:
      return Symbol.for(value.slice(2));
    case 67:
      return context.resolveClientReference(value.slice(2));
    case 81: {
      const entries = decodeFromOutlinedEntries(context, "$Q", value) as Array<[unknown, unknown]>;
      return new Map(entries);
    }
    case 87: {
      const items = decodeFromOutlinedEntries(context, "$W", value);
      return new Set(items);
    }
    case 75:
      return decodeFormDataFromChunk(context, value);
    case 70:
      return decodeServerReferenceFromChunk(context, value);
    case 76: {
      const id = parseHexChunkId(value.slice(2));
      return context.createLazyChunkWrapper(context.getChunk(id));
    }
    case 73:
      return Infinity;
    case 78:
      return NaN;
    case 45:
      return value === "$-0" ? -0 : -Infinity;
    default: {
      const id = parseHexChunkId(value.slice(1));
      const chunk = context.getChunk(id);
      return context.createLazyChunkWrapper(chunk);
    }
  }
}

function maybeDecodeElementTuple<Chunk>(
  value: unknown,
  context: StreamDecodeContext<Chunk>,
): unknown {
  if (!Array.isArray(value) || value.length !== 4 || value[0] !== "$") {
    return value;
  }
  const key = value[2];
  const tracker =
    context.componentTrace ??
    (context.traceContext != null
      ? createComponentTraceTracker({
          requestId: context.traceContext.requestId,
          actionId: context.traceContext.actionId,
          parentSpan: context.traceContext.parentSpan,
        })
      : undefined);
  const componentInfo = describeComponentType(value[1]);
  const decodeSpan = startComponentPhaseSpan(tracker, "decode", {
    ...componentInfo,
    rowId: context.getCurrentRowId?.(),
    source: context.traceContext?.source ?? "react",
    mode: "stream",
    ...summarizeProps(value[3]),
  });
  try {
    const decoded = {
      $$typeof: REACT_ELEMENT_SYMBOL,
      type: value[1],
      key: key == null ? null : String(key),
      ref: null,
      props: value[3] as Record<string, unknown>,
    };
    endComponentPhaseSpan(tracker, decodeSpan.span);
    return decoded;
  } catch (error) {
    endComponentPhaseSpan(tracker, decodeSpan.span, error);
    throw error;
  }
}

export function createModelReviver<Chunk>(
  context: StreamDecodeContext<Chunk>,
): (this: unknown, key: string, value: unknown) => unknown {
  return function modelReviver(_key: string, value: unknown): unknown {
    if (typeof value === "string") {
      return parseModelString(context, value);
    }
    return maybeDecodeElementTuple(value, context);
  };
}

export function createModelReviverWithReviveValues<Chunk>(
  context: StreamDecodeContext<Chunk>,
  reviveValues: string[],
): (this: unknown, key: string, value: unknown) => unknown {
  return function modelReviver(_key: string, value: unknown): unknown {
    if (
      value != null &&
      typeof value === "object" &&
      "__r" in value &&
      !Array.isArray(value) &&
      typeof (value as { __r?: unknown }).__r === "number"
    ) {
      const idx = (value as { __r: number }).__r;
      return parseModelString(context, reviveValues[idx]);
    }
    if (typeof value === "string") {
      return parseModelString(context, value);
    }
    return maybeDecodeElementTuple(value, context);
  };
}

function reviveModelValueTreeInternal<Chunk>(
  context: StreamDecodeContext<Chunk>,
  value: unknown,
): unknown {
  if (value instanceof Date || typeof value === "bigint") {
    return value;
  }
  if (typeof value === "string") {
    return parseModelString(context, value);
  }
  if (value instanceof Map) {
    const entries = Array.from(value.entries()).map(([k, v]) => [
      reviveModelValueTreeInternal(context, k),
      reviveModelValueTreeInternal(context, v),
    ] as const);
    value.clear();
    for (const [k, v] of entries) {
      value.set(k, v);
    }
    return value;
  }
  if (value instanceof Set) {
    const items = Array.from(value.values()).map((v) =>
      reviveModelValueTreeInternal(context, v),
    );
    value.clear();
    for (const item of items) {
      value.add(item);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return maybeDecodeElementTuple(
      Array.from({ length: value.length }, (_, i) =>
        reviveModelValueTreeInternal(context, value[i]),
      ),
      context,
    );
  }
  if (typeof value !== "object" || value == null) {
    return value;
  }
  const source = value as Record<string, unknown>;
  const revived: Record<string, unknown> = {};
  const keys = Object.keys(source);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    revived[key] = reviveModelValueTreeInternal(context, source[key]);
  }
  return revived;
}

export function reviveModelValueTree<Chunk>(
  context: StreamDecodeContext<Chunk>,
  parsedValue: unknown,
): unknown {
  return reviveModelValueTreeInternal(context, parsedValue);
}

function reviveModelValueTreeWithReviveValuesInternal<Chunk>(
  context: StreamDecodeContext<Chunk>,
  reviveValues: string[],
  value: unknown,
): unknown {
  if (value instanceof Date || typeof value === "bigint") {
    return value;
  }
  if (
    value != null &&
    typeof value === "object" &&
    "__r" in value &&
    !Array.isArray(value) &&
    typeof (value as { __r?: unknown }).__r === "number"
  ) {
    const idx = (value as { __r: number }).__r;
    return parseModelString(context, reviveValues[idx]);
  }
  if (typeof value === "string") {
    return parseModelString(context, value);
  }
  if (value instanceof Map) {
    const entries = Array.from(value.entries()).map(([k, v]) => [
      reviveModelValueTreeWithReviveValuesInternal(context, reviveValues, k),
      reviveModelValueTreeWithReviveValuesInternal(context, reviveValues, v),
    ] as const);
    value.clear();
    for (const [k, v] of entries) {
      value.set(k, v);
    }
    return value;
  }
  if (value instanceof Set) {
    const items = Array.from(value.values()).map((v) =>
      reviveModelValueTreeWithReviveValuesInternal(context, reviveValues, v),
    );
    value.clear();
    for (const item of items) {
      value.add(item);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return maybeDecodeElementTuple(
      Array.from({ length: value.length }, (_, i) =>
        reviveModelValueTreeWithReviveValuesInternal(context, reviveValues, value[i]),
      ),
      context,
    );
  }
  if (typeof value !== "object" || value == null) {
    return value;
  }
  const source = value as Record<string, unknown>;
  const revived: Record<string, unknown> = {};
  const keys = Object.keys(source);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    revived[key] = reviveModelValueTreeWithReviveValuesInternal(
      context,
      reviveValues,
      source[key],
    );
  }
  return revived;
}

export function reviveModelValueTreeWithReviveValues<Chunk>(
  context: StreamDecodeContext<Chunk>,
  reviveValues: string[],
  parsedValue: unknown,
): unknown {
  return reviveModelValueTreeWithReviveValuesInternal(context, reviveValues, parsedValue);
}

function getAtPath(root: unknown, path: (string | number)[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[String(segment)];
  }
  return current;
}

function setAtPath(root: unknown, path: (string | number)[], value: unknown): void {
  if (path.length === 0) return;
  let current: unknown = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const segment = path[i];
    if (current == null || typeof current !== "object") return;
    current = (current as Record<string, unknown>)[String(segment)];
  }
  const last = path[path.length - 1];
  if (current != null && typeof current === "object") {
    (current as Record<string, unknown>)[String(last)] = value;
  }
}

export function applyDirectPathReplacements<Chunk>(
  root: unknown,
  revivePaths: ReadonlyArray<(string | number)[]>,
  context: StreamDecodeContext<Chunk>,
): void {
  for (const path of revivePaths) {
    const raw = getAtPath(root, path);
    if (
      typeof raw === "string" &&
      raw.length > 0 &&
      raw.charCodeAt(0) === 36
    ) {
      setAtPath(root, path, parseModelString(context, raw));
    }
  }
}

function traverseElementTuplesOnlyInternal<Chunk>(
  value: unknown,
  context: StreamDecodeContext<Chunk>,
): unknown {
  if (value instanceof Date || typeof value === "bigint") {
    return value;
  }
  if (typeof value === "string") {
    if (value.length > 0 && value.charCodeAt(0) === 36) {
      return parseModelString(context, value);
    }
    return value;
  }
  if (typeof value !== "object" || value == null) {
    return value;
  }
  if (!Array.isArray(value)) {
    return value;
  }
  if (value.length === 4 && value[0] === "$") {
    let type = value[1];
    if (
      typeof type === "string" &&
      type.length > 0 &&
      type.charCodeAt(0) === 36
    ) {
      type = parseModelString(context, type);
    }
    const key = value[2];
    const props = value[3] as Record<string, unknown>;
    const children = props.children;
    const revivedProps: Record<string, unknown> =
      children !== undefined
        ? { ...props, children: traverseElementTuplesOnlyInternal(children, context) }
        : props;
    return maybeDecodeElementTuple(["$", type, key, revivedProps], context);
  }
  return Array.from({ length: value.length }, (_, i) =>
    traverseElementTuplesOnlyInternal(value[i], context),
  );
}

export function traverseElementTuplesOnly<Chunk>(
  context: StreamDecodeContext<Chunk>,
  parsedValue: unknown,
): unknown {
  return traverseElementTuplesOnlyInternal(parsedValue, context);
}

export function createLazyChunkWrapper<Chunk>(
  chunk: Chunk,
  readChunk: (chunk: Chunk) => unknown,
): { $$typeof: symbol; _payload: Chunk; _init: (payload: Chunk) => unknown } {
  return {
    $$typeof: REACT_LAZY_SYMBOL,
    _payload: chunk,
    _init: readChunk,
  };
}

function encodeWireValueImpl(
  value: unknown,
  emitBinaryRow: EmitBinaryRow | null,
  seen: WeakSet<object>,
): unknown {
  if (value === undefined) {
    return { $t: "undef" };
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value == null
  ) {
    return value;
  }
  if (typeof value === "bigint") {
    return { $t: "bigint", v: value.toString() };
  }
  if (typeof value === "symbol") {
    throw new Error("Symbols are not supported by the minimal Flight runtime.");
  }
  if (typeof value === "function") {
    if (isClientReference(value)) {
      return { $t: "clientRef", id: value.$$id };
    }
    if (isServerReference(value)) {
      return { $t: "serverRef", id: value.$$id };
    }
    throw new Error("Functions are not supported by the minimal Flight runtime.");
  }

  if (seen.has(value as object)) {
    throw new Error("Circular structures are not supported by the minimal Flight runtime.");
  }
  seen.add(value as object);

  if (value instanceof Date) {
    return { $t: "date", v: value.toISOString() };
  }
  if (value instanceof URLSearchParams) {
    return { $t: "search", v: value.toString() };
  }
  if (value instanceof FormData) {
    const entries: Array<[string, unknown]> = [];
    for (const [key, item] of value.entries()) {
      if (
        (typeof File !== "undefined" && item instanceof File) ||
        (typeof Blob !== "undefined" && item instanceof Blob)
      ) {
        throw new Error(
          "File and Blob FormData values are not supported by the minimal Flight runtime.",
        );
      }
      entries.push([key, encodeWireValueImpl(item, emitBinaryRow, seen)]);
    }
    return { $t: "formdata", v: entries };
  }
  if (value instanceof Map) {
    return {
      $t: "map",
      v: Array.from(value.entries()).map(([key, item]) => [
        encodeWireValueImpl(key, emitBinaryRow, seen),
        encodeWireValueImpl(item, emitBinaryRow, seen),
      ]),
    };
  }
  if (value instanceof Set) {
    return {
      $t: "set",
      v: Array.from(value.values()).map((item) => encodeWireValueImpl(item, emitBinaryRow, seen)),
    };
  }
  if (value instanceof ArrayBuffer) {
    if (emitBinaryRow != null) {
      return { $t: "rowRef", id: emitBinaryRow("ArrayBuffer", new Uint8Array(value)) };
    }
    throw new Error(
      "Binary values are not supported in JSON wire mode. Use encodeWireValueWithBinaryRows/encodeReply.",
    );
  }
  const typed = normalizeTypedArray(value);
  if (typed != null) {
    if (emitBinaryRow != null) {
      return { $t: "rowRef", id: emitBinaryRow(typed.kind, typed.bytes) };
    }
    throw new Error(
      "Binary values are not supported in JSON wire mode. Use encodeWireValueWithBinaryRows/encodeReply.",
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => encodeWireValueImpl(item, emitBinaryRow, seen));
  }
  if (isReactElementLike(value)) {
    return {
      $t: "element",
      ty: encodeType(value.type),
      props: encodeWireValueImpl(value.props, emitBinaryRow, seen),
      key: value.key,
    };
  }
  if (isClientReference(value)) {
    return { $t: "clientRef", id: value.$$id };
  }
  if (isServerReference(value)) {
    return { $t: "serverRef", id: value.$$id };
  }
  if (!isPlainObject(value)) {
    throw new Error("Only plain objects are serializable by the minimal Flight runtime.");
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = encodeWireValueImpl(item, emitBinaryRow, seen);
  }
  return result;
}

export function encodeWireValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  return encodeWireValueImpl(value, null, seen);
}

export function encodeWireValueWithBinaryRows(
  value: unknown,
  emitBinaryRow: EmitBinaryRow,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  return encodeWireValueImpl(value, emitBinaryRow, seen);
}

export function decodeBinaryWireRow(tag: string, bytes: Uint8Array): unknown {
  switch (tag) {
    case "A":
      return rehydrateArrayBuffer(bytes);
    case "o":
      return bytes;
    case "V":
      return new DataView(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      );
    default:
      return rehydrateTypedArray(binaryWireTagToKind(tag), bytes);
  }
}

function binaryWireTagToKind(tag: string): string {
  switch (tag) {
    case "O":
      return "Int8Array";
    case "U":
      return "Uint8ClampedArray";
    case "S":
      return "Int16Array";
    case "s":
      return "Uint16Array";
    case "L":
      return "Int32Array";
    case "l":
      return "Uint32Array";
    case "G":
      return "Float32Array";
    case "g":
      return "Float64Array";
    case "M":
      return "BigInt64Array";
    case "m":
      return "BigUint64Array";
    default:
      throw new Error(`Unknown binary row tag "${tag}"`);
  }
}

export function binaryWireTagFromKind(kind: string): string {
  switch (kind) {
    case "ArrayBuffer":
      return "A";
    case "Uint8Array":
      return "o";
    case "Int8Array":
      return "O";
    case "Uint8ClampedArray":
      return "U";
    case "Int16Array":
      return "S";
    case "Uint16Array":
      return "s";
    case "Int32Array":
      return "L";
    case "Uint32Array":
      return "l";
    case "Float32Array":
      return "G";
    case "Float64Array":
      return "g";
    case "BigInt64Array":
      return "M";
    case "BigUint64Array":
      return "m";
    case "DataView":
      return "V";
    default:
      throw new Error(`Unsupported binary kind "${kind}"`);
  }
}

export function isBinaryWireRowTag(tag: number): boolean {
  return (
    tag === 65 || // A
    tag === 79 || // O
    tag === 111 || // o
    tag === 85 || // U
    tag === 83 || // S
    tag === 115 || // s
    tag === 76 || // L
    tag === 108 || // l
    tag === 71 || // G
    tag === 103 || // g
    tag === 77 || // M
    tag === 109 || // m
    tag === 86 // V
  );
}

export const ROW_MODEL = 0 as const;
export const ROW_BINARY = 1 as const;
export const ROW_DONE = 2 as const;
export const ROW_ERROR = 3 as const;
export const ROW_METADATA = 4 as const;

export type FlightRowMessage =
  | { k: typeof ROW_MODEL; id: number; v: unknown }
  | { k: typeof ROW_BINARY; id: number; t: string; v: ArrayBuffer }
  | { k: typeof ROW_DONE }
  | { k: typeof ROW_ERROR; v: string }
  | { k: typeof ROW_METADATA; id: number; revivePaths: (string | number)[][] };

export function flightModelRow(id: number, value: unknown): FlightRowMessage {
  return { k: ROW_MODEL, id, v: value };
}

export function flightMetadataRow(
  id: number,
  revivePaths: (string | number)[][],
): FlightRowMessage {
  return { k: ROW_METADATA, id, revivePaths };
}

function toTransferableBuffer(bytes: Uint8Array): ArrayBuffer {
  const start = bytes.byteOffset;
  const end = bytes.byteOffset + bytes.byteLength;
  const backing = bytes.buffer;
  if (backing instanceof ArrayBuffer) {
    return backing.slice(start, end);
  }
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  return copied.buffer;
}

export function flightBinaryRow(
  id: number,
  kind: string,
  bytes: Uint8Array,
): { row: FlightRowMessage; transfer: Transferable[] } {
  const tag = binaryWireTagFromKind(kind);
  const buffer = toTransferableBuffer(bytes);
  return {
    row: { k: ROW_BINARY, id, t: tag, v: buffer },
    transfer: [buffer],
  };
}

export function flightDoneRow(): FlightRowMessage {
  return { k: ROW_DONE };
}

export function flightErrorRow(message: string): FlightRowMessage {
  return { k: ROW_ERROR, v: message };
}

export function decodeWireValue(
  value: unknown,
  resolveClientReference: (id: string) => unknown,
  resolveRowReference?: (id: string) => unknown,
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>,
  traceOptions?: {
    traceContext?: RSCTraceContext;
    componentTrace?: ComponentTraceTracker;
    currentRowId?: number;
  },
): unknown {
  const componentTrace =
    traceOptions?.componentTrace ??
    (traceOptions?.traceContext != null
      ? createComponentTraceTracker({
          requestId: traceOptions.traceContext.requestId,
          actionId: traceOptions.traceContext.actionId,
          parentSpan: traceOptions.traceContext.parentSpan,
        })
      : undefined);
  return decodeWireValueInternal(
    value,
    resolveClientReference,
    resolveRowReference,
    callServer,
    new Set<string>(),
    traceOptions?.traceContext,
    componentTrace,
    traceOptions?.currentRowId,
  );
}

function decodeWireValueInternal(
  value: unknown,
  resolveClientReference: (id: string) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
  traceContext: RSCTraceContext | undefined,
  componentTrace: ComponentTraceTracker | undefined,
  currentRowId: number | undefined,
): unknown {
  if (typeof value !== "object" || value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    return decodeWireArrayValue(
      value,
      resolveClientReference,
      resolveRowReference,
      callServer,
      visitingRowRefs,
      traceContext,
      componentTrace,
      currentRowId,
    );
  }

  const tagged = value as Record<string, unknown>;
  const tag = tagged.$t;
  if (typeof tag === "string") {
    return decodeTaggedWireValue(
      tag,
      tagged,
      resolveClientReference,
      resolveRowReference,
      callServer,
      visitingRowRefs,
      traceContext,
      componentTrace,
      currentRowId,
    );
  }
  return decodeWirePlainObjectValue(
    tagged,
    resolveClientReference,
    resolveRowReference,
    callServer,
    visitingRowRefs,
    traceContext,
    componentTrace,
    currentRowId,
  );
}

function decodeWireArrayValue(
  value: unknown[],
  resolveClientReference: (id: string) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
  traceContext: RSCTraceContext | undefined,
  componentTrace: ComponentTraceTracker | undefined,
  currentRowId: number | undefined,
): unknown[] {
  return Array.from({ length: value.length }, (_, i) =>
    decodeWireValueInternal(
      value[i],
      resolveClientReference,
      resolveRowReference,
      callServer,
      visitingRowRefs,
      traceContext,
      componentTrace,
      currentRowId,
    ),
  );
}

function decodeWirePlainObjectValue(
  value: Record<string, unknown>,
  resolveClientReference: (id: string) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
  traceContext: RSCTraceContext | undefined,
  componentTrace: ComponentTraceTracker | undefined,
  currentRowId: number | undefined,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    result[key] = decodeWireValueInternal(
      value[key],
      resolveClientReference,
      resolveRowReference,
      callServer,
      visitingRowRefs,
      traceContext,
      componentTrace,
      currentRowId,
    );
  }
  return result;
}

function decodeWireRowReferenceValue(
  value: Record<string, unknown>,
  resolveClientReference: (id: string) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
  traceContext: RSCTraceContext | undefined,
  componentTrace: ComponentTraceTracker | undefined,
  currentRowId: number | undefined,
): unknown {
  if (resolveRowReference == null) {
    throw new Error('Unknown wire tag "rowRef"');
  }
  const rowId = String(value.id);
  if (visitingRowRefs.has(rowId)) {
    throw new Error(`[rsc-prism] Circular row reference "${rowId}" in Flight payload.`);
  }
  visitingRowRefs.add(rowId);
  try {
    const rowValue = resolveRowReference(rowId);
    if (rowValue == null) {
      throw new Error(`[rsc-prism] Missing row "${rowId}" in Flight payload.`);
    }
    if (
      typeof rowValue !== "object" ||
      rowValue instanceof ArrayBuffer ||
      ArrayBuffer.isView(rowValue)
    ) {
      return rowValue;
    }
    return decodeWireValueInternal(
      rowValue,
      resolveClientReference,
      resolveRowReference,
      callServer,
      visitingRowRefs,
      traceContext,
      componentTrace,
      currentRowId,
    );
  } finally {
    visitingRowRefs.delete(rowId);
  }
}

function decodeWireMapValue(
  value: Record<string, unknown>,
  resolveClientReference: (id: string) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
  traceContext: RSCTraceContext | undefined,
  componentTrace: ComponentTraceTracker | undefined,
  currentRowId: number | undefined,
): Map<unknown, unknown> {
  const entries = (value.v as unknown[]) ?? EMPTY_ARRAY;
  if (!Array.isArray(entries)) {
    return new Map();
  }
  const mapped = new Map<unknown, unknown>();
  for (let i = 0; i < entries.length; i += 1) {
    const tuple = entries[i] as unknown[];
    mapped.set(
      decodeWireValueInternal(
        tuple[0],
        resolveClientReference,
        resolveRowReference,
        callServer,
        visitingRowRefs,
        traceContext,
        componentTrace,
        currentRowId,
      ),
      decodeWireValueInternal(
        tuple[1],
        resolveClientReference,
        resolveRowReference,
        callServer,
        visitingRowRefs,
        traceContext,
        componentTrace,
        currentRowId,
      ),
    );
  }
  return mapped;
}

function decodeWireSetValue(
  value: Record<string, unknown>,
  resolveClientReference: (id: string) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
  traceContext: RSCTraceContext | undefined,
  componentTrace: ComponentTraceTracker | undefined,
  currentRowId: number | undefined,
): Set<unknown> {
  const items = (value.v as unknown[]) ?? EMPTY_ARRAY;
  if (!Array.isArray(items)) {
    return new Set();
  }
  const decoded = new Set<unknown>();
  for (let i = 0; i < items.length; i += 1) {
    decoded.add(
      decodeWireValueInternal(
        items[i],
        resolveClientReference,
        resolveRowReference,
        callServer,
        visitingRowRefs,
        traceContext,
        componentTrace,
        currentRowId,
      ),
    );
  }
  return decoded;
}

function decodeWireFormDataValue(
  value: Record<string, unknown>,
  resolveClientReference: (id: string) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
  traceContext: RSCTraceContext | undefined,
  componentTrace: ComponentTraceTracker | undefined,
  currentRowId: number | undefined,
): FormData {
  const entries = (value.v as unknown[]) ?? EMPTY_ARRAY;
  const form = new FormData();
  if (!Array.isArray(entries)) {
    return form;
  }
  for (let i = 0; i < entries.length; i += 1) {
    const tuple = entries[i] as unknown[];
    const key = tuple[0];
    const item = tuple[1];
    const decoded = decodeWireValueInternal(
      item,
      resolveClientReference,
      resolveRowReference,
      callServer,
      visitingRowRefs,
      traceContext,
      componentTrace,
      currentRowId,
    );
    form.append(
      typeof key === "string" ? key : String(key),
      typeof decoded === "string" ? decoded : String(decoded),
    );
  }
  return form;
}

function decodeWireElementValue(
  value: Record<string, unknown>,
  resolveClientReference: (id: string) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
  traceContext: RSCTraceContext | undefined,
  componentTrace: ComponentTraceTracker | undefined,
  currentRowId: number | undefined,
): {
  $$typeof: symbol;
  type: unknown;
  key: string | null;
  ref: null;
  props: Record<string, unknown>;
} {
  const type = decodeType(value.ty as JsonObject, resolveClientReference);
  const decodeSpan = startComponentPhaseSpan(componentTrace, "decode", {
    ...describeComponentType(type),
    rowId: currentRowId,
    source: traceContext?.source ?? "server",
    mode: "wire",
    ...summarizeProps(value.props),
  });
  try {
    const props = decodeWireValueInternal(
      value.props,
      resolveClientReference,
      resolveRowReference,
      callServer,
      visitingRowRefs,
      traceContext,
      componentTrace,
      currentRowId,
    ) as Record<string, unknown>;
    const key = value.key as string | null;
    const decoded = {
      $$typeof: REACT_ELEMENT_SYMBOL,
      type,
      key: key == null ? null : key,
      ref: null,
      props,
    };
    endComponentPhaseSpan(componentTrace, decodeSpan.span);
    return decoded;
  } catch (error) {
    endComponentPhaseSpan(componentTrace, decodeSpan.span, error);
    throw error;
  }
}

function decodeTaggedWireValue(
  tag: string,
  value: Record<string, unknown>,
  resolveClientReference: (id: string) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
  traceContext: RSCTraceContext | undefined,
  componentTrace: ComponentTraceTracker | undefined,
  currentRowId: number | undefined,
): unknown {
  switch (tag) {
    case "rowRef":
      return decodeWireRowReferenceValue(
        value,
        resolveClientReference,
        resolveRowReference,
        callServer,
        visitingRowRefs,
        traceContext,
        componentTrace,
        currentRowId,
      );
    case "undef":
      return undefined;
    case "bigint":
      return BigInt(value.v as string);
    case "date":
      return new Date(value.v as string);
    case "search":
      return new URLSearchParams(value.v as string);
    case "map":
      return decodeWireMapValue(
        value,
        resolveClientReference,
        resolveRowReference,
        callServer,
        visitingRowRefs,
        traceContext,
        componentTrace,
        currentRowId,
      );
    case "set":
      return decodeWireSetValue(
        value,
        resolveClientReference,
        resolveRowReference,
        callServer,
        visitingRowRefs,
        traceContext,
        componentTrace,
        currentRowId,
      );
    case "formdata":
      return decodeWireFormDataValue(
        value,
        resolveClientReference,
        resolveRowReference,
        callServer,
        visitingRowRefs,
        traceContext,
        componentTrace,
        currentRowId,
      );
    case "clientRef":
      return resolveClientReference(value.id as string);
    case "serverRef":
      return createServerReference(value.id as string, callServer);
    case "element":
      return decodeWireElementValue(
        value,
        resolveClientReference,
        resolveRowReference,
        callServer,
        visitingRowRefs,
        traceContext,
        componentTrace,
        currentRowId,
      );
    default:
      throw new Error(`Unknown wire tag "${tag}"`);
  }
}
