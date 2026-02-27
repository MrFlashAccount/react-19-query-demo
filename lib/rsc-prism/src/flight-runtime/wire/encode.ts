/**
 * Wire encoding: converts JS values to Flight wire format.
 *
 * Two modes: (1) Stream encoding mutates in-place and emits revivable refs ($X...)
 * for deferred values; (2) JSON wire encoding produces tagged objects for
 * encodeReply-style payloads. We avoid copying where safe to reduce allocations.
 */
import { Fragment } from "react";
import type { EmitBinaryRow, JsonObject, StreamEncodeContext } from "./types";
import {
  isClientReference,
  isFlightWireString,
  isPlainObject,
  isReactElementLike,
  isServerReference,
  normalizeTypedArray,
} from "./shared";
import { REACT_FRAGMENT_SYMBOL } from "./constants";

/** Prefixes '$' to strings that would otherwise be parsed as Flight refs, so they round-trip as plain strings. */
export function escapeStringValue(str: string): string {
  return isFlightWireString(str) ? `$${str}` : str;
}

function encodeType(value: unknown): JsonObject {
  if (typeof value === "string") {
    return { $t: "host", v: value };
  }
  if (value === REACT_FRAGMENT_SYMBOL || value === Fragment) {
    return { $t: "fragment" };
  }
  if (isClientReference(value)) {
    return { $t: "client", id: value.$$refId };
  }
  throw new Error("Unsupported element type in minimal runtime.");
}

function emitRevivable(context: StreamEncodeContext, encoded: string): string {
  const path = context._path ?? [];
  context.pushReviveValue?.(encoded, path);
  return encoded;
}

function getMutablePath(context: StreamEncodeContext): (string | number)[] {
  if (context._path == null) {
    context._path = [];
  }
  return context._path;
}

/** Encodes element type (string, Fragment, client ref) to wire string; used for React element tuples. */
export function encodeStreamType(value: unknown, context?: StreamEncodeContext): string {
  if (typeof value === "string") {
    return escapeStringValue(value);
  }
  if (value === REACT_FRAGMENT_SYMBOL || value === Fragment) {
    return context ? emitRevivable(context, "$Sreact.fragment") : "$Sreact.fragment";
  }
  if (isClientReference(value)) {
    return context
      ? emitRevivable(context, `$R${value.$$refId.toString(16)}`)
      : `$R${value.$$refId.toString(16)}`;
  }
  throw new Error("Unsupported element type in minimal runtime.");
}

/**
 * Stream encoding: mutates Maps/Sets/arrays in-place. Emits $X refs for symbols,
 * FormData, binary, server refs; outlines large values via context.outlineValue.
 */
function encodeStreamValueInternal(value: unknown, context: StreamEncodeContext): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return escapeStringValue(value);
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean" || value == null) {
    return value;
  }
  if (typeof value === "bigint") {
    return value;
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
      return emitRevivable(context, `$R${value.$$refId.toString(16)}`);
    }
    if (isServerReference(value)) {
      const outlinedId = context.outlineValue({ id: value.$$id });
      return emitRevivable(context, `$F${outlinedId.toString(16)}`);
    }
    throw new Error("Functions are not supported by the minimal Flight runtime.");
  }

  if (value instanceof Date) {
    return value;
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
    value.forEach((v, k) => {
      value.delete(k);
      value.set(encodeStreamValueInternal(k, context), encodeStreamValueInternal(v, context));
    });
    return value;
  }
  if (value instanceof Set) {
    value.forEach((v) => {
      value.delete(v);
      value.add(encodeStreamValueInternal(v, context));
    });
    return value;
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
    const path = getMutablePath(context);
    for (let i = 0; i < value.length; i += 1) {
      path.push(i);
      try {
        value[i] = encodeStreamValueInternal(value[i], context);
      } finally {
        path.pop();
      }
    }
    return value;
  }
  if (isReactElementLike(value)) {
    const path = getMutablePath(context);
    path.push(1);
    let type: string;
    try {
      type = encodeStreamType(value.type, context);
    } finally {
      path.pop();
    }
    const key = value.key == null ? null : String(value.key);
    path.push(3);
    let props: unknown;
    try {
      props = encodeStreamValueInternal(value.props, context);
    } finally {
      path.pop();
    }
    return ["$", type, key, props];
  }
  if (isClientReference(value)) {
    return emitRevivable(context, `$R${value.$$refId.toString(16)}`);
  }
  if (isServerReference(value)) {
    const outlinedId = context.outlineValue({ id: value.$$id });
    return emitRevivable(context, `$F${outlinedId.toString(16)}`);
  }
  if (!isPlainObject(value)) {
    throw new Error("Only plain objects are serializable by the minimal Flight runtime.");
  }

  const result: Record<string, unknown> = {};
  const path = getMutablePath(context);
  for (const [key, item] of Object.entries(value)) {
    path.push(key);
    try {
      result[key] = encodeStreamValueInternal(item, context);
    } finally {
      path.pop();
    }
  }
  return result;
}

export function encodeStreamValue(value: unknown, context: StreamEncodeContext): unknown {
  return encodeStreamValueInternal(value, context);
}

export type WireEncodeOptions = {
  pushRevivePath?: (path: (string | number)[]) => void;
};

function emitTaggedAndRecordPath(
  tagged: { $t: string; [k: string]: unknown },
  path: (string | number)[],
  pushRevivePath?: (path: (string | number)[]) => void,
): { $t: string; [k: string]: unknown } {
  pushRevivePath?.(path);
  return tagged;
}

/**
 * JSON wire encoding: produces { $t, v } tagged objects. Used for encodeReply
 * and action args. Binary requires emitBinaryRow; without it we throw to avoid
 * silently dropping data.
 */
function encodeWireValueImpl(
  value: unknown,
  emitBinaryRow: EmitBinaryRow | null,
  seen: WeakSet<object>,
  path: (string | number)[],
  pushRevivePath?: (path: (string | number)[]) => void,
): unknown {
  if (value === undefined) {
    return emitTaggedAndRecordPath({ $t: "undef" }, path, pushRevivePath);
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
    return emitTaggedAndRecordPath({ $t: "bigint", v: value.toString() }, path, pushRevivePath);
  }
  if (typeof value === "symbol") {
    throw new Error("Symbols are not supported by the minimal Flight runtime.");
  }
  if (typeof value === "function") {
    if (isClientReference(value)) {
      return emitTaggedAndRecordPath({ $t: "clientRef", id: value.$$refId }, path, pushRevivePath);
    }
    if (isServerReference(value)) {
      return emitTaggedAndRecordPath({ $t: "serverRef", id: value.$$id }, path, pushRevivePath);
    }
    throw new Error("Functions are not supported by the minimal Flight runtime.");
  }

  if (seen.has(value as object)) {
    throw new Error("Circular structures are not supported by the minimal Flight runtime.");
  }
  seen.add(value as object);

  if (value instanceof Date) {
    return emitTaggedAndRecordPath({ $t: "date", v: value.toISOString() }, path, pushRevivePath);
  }
  if (value instanceof URLSearchParams) {
    return emitTaggedAndRecordPath({ $t: "search", v: value.toString() }, path, pushRevivePath);
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
    return emitTaggedAndRecordPath({ $t: "formdata", v: entries }, path, pushRevivePath);
  }
  if (value instanceof Map) {
    const v = Array.from(value.entries()).map(([key, item], i) => [
      encodeWireValueImpl(key, emitBinaryRow, seen, [...path, "v", i, 0], pushRevivePath),
      encodeWireValueImpl(item, emitBinaryRow, seen, [...path, "v", i, 1], pushRevivePath),
    ]);
    return emitTaggedAndRecordPath({ $t: "map", v }, path, pushRevivePath);
  }
  if (value instanceof Set) {
    const v = Array.from(value.values()).map((item, i) =>
      encodeWireValueImpl(item, emitBinaryRow, seen, [...path, "v", i], pushRevivePath),
    );
    return emitTaggedAndRecordPath({ $t: "set", v }, path, pushRevivePath);
  }
  if (value instanceof ArrayBuffer) {
    if (emitBinaryRow != null) {
      return emitTaggedAndRecordPath(
        { $t: "rowRef", id: emitBinaryRow("ArrayBuffer", new Uint8Array(value)) },
        path,
        pushRevivePath,
      );
    }
    throw new Error(
      "Binary values are not supported in JSON wire mode. Use encodeWireValueWithBinaryRows/encodeReply.",
    );
  }
  const typed = normalizeTypedArray(value);
  if (typed != null) {
    if (emitBinaryRow != null) {
      return emitTaggedAndRecordPath(
        { $t: "rowRef", id: emitBinaryRow(typed.kind, typed.bytes) },
        path,
        pushRevivePath,
      );
    }
    throw new Error(
      "Binary values are not supported in JSON wire mode. Use encodeWireValueWithBinaryRows/encodeReply.",
    );
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = encodeWireValueImpl(value[i], emitBinaryRow, seen, [...path, i], pushRevivePath);
    }
    return value;
  }
  if (isReactElementLike(value)) {
    return emitTaggedAndRecordPath(
      {
        $t: "element",
        ty: encodeType(value.type),
        props: encodeWireValueImpl(
          value.props,
          emitBinaryRow,
          seen,
          [...path, "props"],
          pushRevivePath,
        ),
        key: value.key,
      },
      path,
      pushRevivePath,
    );
  }
  if (isClientReference(value)) {
    return emitTaggedAndRecordPath({ $t: "clientRef", id: value.$$refId }, path, pushRevivePath);
  }
  if (isServerReference(value)) {
    return emitTaggedAndRecordPath({ $t: "serverRef", id: value.$$id }, path, pushRevivePath);
  }
  if (!isPlainObject(value)) {
    throw new Error("Only plain objects are serializable by the minimal Flight runtime.");
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = encodeWireValueImpl(item, emitBinaryRow, seen, [...path, key], pushRevivePath);
  }
  return result;
}

export function encodeWireValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  options?: WireEncodeOptions,
): unknown {
  return encodeWireValueImpl(value, null, seen, [], options?.pushRevivePath);
}

/** Same as encodeWireValue but allows ArrayBuffer/TypedArray via emitBinaryRow callback. */
export function encodeWireValueWithBinaryRows(
  value: unknown,
  emitBinaryRow: EmitBinaryRow,
  seen: WeakSet<object> = new WeakSet(),
  options?: WireEncodeOptions,
): unknown {
  return encodeWireValueImpl(value, emitBinaryRow, seen, [], options?.pushRevivePath);
}
