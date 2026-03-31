/**
 * Shared predicates and utilities for wire encode/decode.
 *
 * Type guards use explicit symbol checks (not instanceof) because React
 * references can be functions; isPlainObject excludes arrays/class instances
 * to match JSON-serializable shape.
 */
import {
  CHR,
  CLIENT_REFERENCE_SYMBOL,
  LEGACY_REACT_ELEMENT_SYMBOL,
  REACT_ELEMENT_SYMBOL,
  SERVER_REFERENCE_SYMBOL,
} from "./constants";

/** True if string starts with '$' — Flight uses this to distinguish plain strings from revivable refs. */
export function isFlightWireString(str: string): boolean {
  return str.length > 0 && str[0] === CHR.ELEMENT_PREFIX;
}

/** Excludes arrays and class instances; needed because Map/Set/etc have Object in their prototype chain. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Parses hex chunk id; throws on invalid input to fail fast rather than produce corrupted state. */
export function parseHexChunkId(raw: string): number {
  const id = Number.parseInt(raw, 16);
  if (!Number.isFinite(id) || id < 0) {
    throw new Error(`[rsc-prism] Invalid chunk id "${raw}" in Flight payload.`);
  }
  return id;
}

/**
 * Produces a copy when the view spans a SharedArrayBuffer or has non-zero offset,
 * so the result is safe to transfer and has predictable alignment for typed arrays.
 */
export function toArrayBuffer(
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

/**
 * Extracts raw bytes from any TypedArray/DataView. Used so we can serialize
 * binary data as a single Uint8Array row and rehydrate with correct constructor.
 */
export function normalizeTypedArray(value: unknown): { kind: string; bytes: Uint8Array } | null {
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

/** Matches both react.transitional.element and react.element for compatibility across React versions. */
export function isReactElementLike(value: unknown): value is {
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

/** Client refs can be functions (module exports); check $$typeof before assuming object shape. */
export function isClientReference(
  value: unknown,
): value is { $$typeof: symbol; $$id: string; $$refId: number } {
  if (typeof value !== "function" && (typeof value !== "object" || value == null)) {
    return false;
  }
  const candidate = value as { $$typeof?: unknown; $$id?: unknown; $$refId?: unknown };
  return (
    candidate.$$typeof === CLIENT_REFERENCE_SYMBOL &&
    typeof candidate.$$id === "string" &&
    typeof candidate.$$refId === "number"
  );
}

/** Server refs are async functions; same symbol check as client refs. */
export function isServerReference(value: unknown): value is { $$typeof: symbol; $$id: string } {
  if (typeof value !== "function" && (typeof value !== "object" || value == null)) {
    return false;
  }
  const candidate = value as { $$typeof?: unknown; $$id?: unknown };
  return candidate.$$typeof === SERVER_REFERENCE_SYMBOL && typeof candidate.$$id === "string";
}
