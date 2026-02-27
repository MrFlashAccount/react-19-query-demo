/**
 * Wire encoding: converts JS values to Flight wire format.
 *
 * Two modes: (1) Stream encoding mutates in-place and emits revivable refs ($X...)
 * for deferred values; (2) JSON wire encoding produces tagged objects for
 * encodeReply-style payloads. We avoid copying where safe to reduce allocations.
 */
import { Fragment } from "react";
import type { StreamEncodeContext } from "./types";
import {
  isClientReference,
  isFlightWireString,
  isPlainObject,
  isReactElementLike,
  isServerReference,
  normalizeTypedArray,
} from "./shared";
import { CHR, CHR_PREFIXES, REACT_FRAGMENT_SYMBOL, WIRE_TAG, WIRE_TAG_SENTINEL } from "./constants";

/** Prefixes '$' to strings that would otherwise be parsed as Flight refs, so they round-trip as plain strings. */
export function escapeStringValue(str: string): string {
  return isFlightWireString(str) ? `$${str}` : str;
}

/** Compact wire format for element type (host, fragment, client ref). */
function encodeWireType(value: unknown): unknown[] {
  if (typeof value === "string") {
    return [WIRE_TAG_SENTINEL, WIRE_TAG.HOST, value];
  }
  if (value === REACT_FRAGMENT_SYMBOL || value === Fragment) {
    return [WIRE_TAG_SENTINEL, WIRE_TAG.FRAGMENT];
  }
  if (isClientReference(value)) {
    return [WIRE_TAG_SENTINEL, WIRE_TAG.CLIENT_REF, value.$$refId];
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
    return emitRevivable(context, `${CHR_PREFIXES.SYMBOL}${key}`);
  }
  if (typeof value === "function") {
    if (isClientReference(value)) {
      return emitRevivable(
        context,
        `${CHR_PREFIXES.CLIENT_REFERENCE}${value.$$refId.toString(16)}`,
      );
    }
    if (isServerReference(value)) {
      const outlinedId = context.outlineValue({ id: value.$$id });
      return emitRevivable(context, `${CHR_PREFIXES.SERVER_REFERENCE}${outlinedId.toString(16)}`);
    }
    throw new Error("Functions are not supported by the minimal Flight runtime.");
  }

  if (value instanceof Date) {
    return value;
  }
  if (value instanceof URLSearchParams) {
    return emitRevivable(context, `${CHR_PREFIXES.URL_SEARCH_PARAMS}${value.toString()}`);
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
    return emitRevivable(context, `${CHR_PREFIXES.FORM_DATA}${outlinedId.toString(16)}`);
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
    return emitRevivable(context, `${CHR.ELEMENT_PREFIX}${id.toString(16)}`);
  }
  const typed = normalizeTypedArray(value);
  if (typed != null) {
    const id = context.emitBinaryRow(typed.kind, typed.bytes);
    return emitRevivable(context, `${CHR.ELEMENT_PREFIX}${id.toString(16)}`);
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
    return [CHR.ELEMENT_PREFIX, type, key, props];
  }
  if (isClientReference(value)) {
    return emitRevivable(context, `${CHR_PREFIXES.CLIENT_REFERENCE}${value.$$refId.toString(16)}`);
  }
  if (isServerReference(value)) {
    const outlinedId = context.outlineValue({ id: value.$$id });
    return emitRevivable(context, `${CHR_PREFIXES.SERVER_REFERENCE}${outlinedId.toString(16)}`);
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
  /** Callback for binary values; returns id string to use as ref. Required for encodeWireValueWithBinaryRows. */
  emitBinaryRow?: (kind: string, bytes: Uint8Array) => string | number;
};

function emitTaggedAndRecordPath(
  tagged: unknown[],
  path: (string | number)[],
  pushRevivePath?: (path: (string | number)[]) => void,
): unknown[] {
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
  path: (string | number)[],
  pushRevivePath?: (path: (string | number)[]) => void,
  emitBinaryRow?: (kind: string, bytes: Uint8Array) => string | number,
): unknown {
  if (value === undefined) {
    return undefined;
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
    return value;
  }
  if (typeof value === "symbol") {
    throw new Error("Symbols can not be sent as values.");
  }
  if (typeof value === "function") {
    if (isClientReference(value)) {
      return emitTaggedAndRecordPath(
        [WIRE_TAG_SENTINEL, WIRE_TAG.CLIENT_REF, value.$$refId],
        path,
        pushRevivePath,
      );
    }
    if (isServerReference(value)) {
      return emitTaggedAndRecordPath(
        [WIRE_TAG_SENTINEL, WIRE_TAG.SERVER_REF, value.$$id],
        path,
        pushRevivePath,
      );
    }

    throw new Error(
      `Only client and server references can be sent. If you want to send a function ${value.name}, you need to mark it either as a client or server reference.`,
    );
  }

  if (value instanceof Date) {
    return value;
  }

  if (value instanceof URLSearchParams) {
    return value;
  }

  if (value instanceof FormData) {
    return value;
  }

  if (value instanceof Map) {
    const mapped = new Map<unknown, unknown>();
    let i = 0;
    for (const [key, item] of value.entries()) {
      mapped.set(
        encodeWireValueImpl(key, [...path, 2, i, 0], pushRevivePath, emitBinaryRow),
        encodeWireValueImpl(item, [...path, 2, i, 1], pushRevivePath, emitBinaryRow),
      );
      i += 1;
    }
    return mapped;
  }

  if (value instanceof Set) {
    const decoded = new Set<unknown>();
    let i = 0;
    for (const item of value.values()) {
      decoded.add(encodeWireValueImpl(item, [...path, 2, i], pushRevivePath, emitBinaryRow));
      i += 1;
    }
    return decoded;
  }

  if (value instanceof ArrayBuffer) {
    if (emitBinaryRow != null) {
      const id = emitBinaryRow("ArrayBuffer", new Uint8Array(value));
      return [WIRE_TAG_SENTINEL, WIRE_TAG.ROW_REF, String(id)];
    }
    return value;
  }

  const typed = normalizeTypedArray(value);

  if (typed != null) {
    if (emitBinaryRow != null) {
      const id = emitBinaryRow(typed.kind, typed.bytes);
      return [WIRE_TAG_SENTINEL, WIRE_TAG.ROW_REF, String(id)];
    }
    return value;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = encodeWireValueImpl(value[i], [...path, i], pushRevivePath, emitBinaryRow);
    }
    return value;
  }
  if (isReactElementLike(value)) {
    return emitTaggedAndRecordPath(
      [
        WIRE_TAG_SENTINEL,
        WIRE_TAG.ELEMENT,
        encodeWireType(value.type),
        encodeWireValueImpl(value.props, [...path, 2, "props"], pushRevivePath, emitBinaryRow),
        value.key,
      ],
      path,
      pushRevivePath,
    );
  }
  if (isClientReference(value)) {
    return emitTaggedAndRecordPath(
      [WIRE_TAG_SENTINEL, WIRE_TAG.CLIENT_REF, value.$$refId],
      path,
      pushRevivePath,
    );
  }
  if (isServerReference(value)) {
    return emitTaggedAndRecordPath(
      [WIRE_TAG_SENTINEL, WIRE_TAG.SERVER_REF, value.$$id],
      path,
      pushRevivePath,
    );
  }
  if (!isPlainObject(value)) {
    throw new Error("Only plain objects can be sent as values.");
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = encodeWireValueImpl(item, [...path, key], pushRevivePath, emitBinaryRow);
  }
  return result;
}

export function encodeWireValue(value: unknown, options?: WireEncodeOptions): unknown {
  return encodeWireValueImpl(value, [], options?.pushRevivePath, undefined);
}

/** Same as encodeWireValue but allows ArrayBuffer/TypedArray via emitBinaryRow callback. */
export function encodeWireValueWithBinaryRows(
  value: unknown,
  options?: WireEncodeOptions,
): unknown {
  return encodeWireValueImpl(value, [], options?.pushRevivePath, options?.emitBinaryRow);
}
