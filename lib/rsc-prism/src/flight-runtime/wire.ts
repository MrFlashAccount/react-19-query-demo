import { createElement, Fragment, isValidElement } from "react";

const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
const SERVER_REFERENCE_SYMBOL = Symbol.for("react.server.reference");
const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
const LEGACY_REACT_ELEMENT_SYMBOL = Symbol.for("react.element");
const REACT_FRAGMENT_SYMBOL = Symbol.for("react.fragment");

type JsonObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function encodeBytes(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizeTypedArray(value: unknown): { kind: string; bytes: Uint8Array } | null {
  if (value instanceof Uint8Array) return { kind: "Uint8Array", bytes: value };
  if (value instanceof Int8Array) return { kind: "Int8Array", bytes: new Uint8Array(value.buffer) };
  if (value instanceof Uint8ClampedArray)
    return { kind: "Uint8ClampedArray", bytes: new Uint8Array(value.buffer) };
  if (value instanceof Int16Array) return { kind: "Int16Array", bytes: new Uint8Array(value.buffer) };
  if (value instanceof Uint16Array) return { kind: "Uint16Array", bytes: new Uint8Array(value.buffer) };
  if (value instanceof Int32Array) return { kind: "Int32Array", bytes: new Uint8Array(value.buffer) };
  if (value instanceof Uint32Array) return { kind: "Uint32Array", bytes: new Uint8Array(value.buffer) };
  if (value instanceof Float32Array) return { kind: "Float32Array", bytes: new Uint8Array(value.buffer) };
  if (value instanceof Float64Array) return { kind: "Float64Array", bytes: new Uint8Array(value.buffer) };
  if (value instanceof BigInt64Array) return { kind: "BigInt64Array", bytes: new Uint8Array(value.buffer) };
  if (value instanceof BigUint64Array)
    return { kind: "BigUint64Array", bytes: new Uint8Array(value.buffer) };
  if (value instanceof DataView) return { kind: "DataView", bytes: new Uint8Array(value.buffer) };
  return null;
}

function rehydrateTypedArray(kind: string, bytes: Uint8Array): unknown {
  switch (kind) {
    case "Uint8Array":
      return bytes;
    case "Int8Array":
      return new Int8Array(bytes.buffer.slice(0));
    case "Uint8ClampedArray":
      return new Uint8ClampedArray(bytes.buffer.slice(0));
    case "Int16Array":
      return new Int16Array(bytes.buffer.slice(0));
    case "Uint16Array":
      return new Uint16Array(bytes.buffer.slice(0));
    case "Int32Array":
      return new Int32Array(bytes.buffer.slice(0));
    case "Uint32Array":
      return new Uint32Array(bytes.buffer.slice(0));
    case "Float32Array":
      return new Float32Array(bytes.buffer.slice(0));
    case "Float64Array":
      return new Float64Array(bytes.buffer.slice(0));
    case "BigInt64Array":
      return new BigInt64Array(bytes.buffer.slice(0));
    case "BigUint64Array":
      return new BigUint64Array(bytes.buffer.slice(0));
    case "DataView":
      return new DataView(bytes.buffer.slice(0));
    default:
      throw new Error(`Unsupported typed array kind "${kind}"`);
  }
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
    candidate.$$typeof === REACT_ELEMENT_SYMBOL || candidate.$$typeof === LEGACY_REACT_ELEMENT_SYMBOL
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

function decodeType(
  value: JsonObject,
  resolveClientReference: (id: string) => unknown,
): string | symbol | unknown {
  switch (value.$t) {
    case "host":
      return value.v as string;
    case "fragment":
      return Fragment;
    case "client":
      return resolveClientReference(String(value.id));
    default:
      throw new Error(`Unsupported encoded element type "${String(value.$t)}"`);
  }
}

export function encodeWireValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === undefined) {
    return { $t: "undef" };
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value == null) {
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
        throw new Error("File and Blob FormData values are not supported by the minimal Flight runtime.");
      }
      entries.push([key, encodeWireValue(item, seen)]);
    }
    return { $t: "formdata", v: entries };
  }
  if (value instanceof Map) {
    return {
      $t: "map",
      v: Array.from(value.entries()).map(([key, item]) => [
        encodeWireValue(key, seen),
        encodeWireValue(item, seen),
      ]),
    };
  }
  if (value instanceof Set) {
    return {
      $t: "set",
      v: Array.from(value.values()).map((item) => encodeWireValue(item, seen)),
    };
  }
  if (value instanceof ArrayBuffer) {
    return { $t: "arrayBuffer", v: encodeBytes(new Uint8Array(value)) };
  }
  const typed = normalizeTypedArray(value);
  if (typed != null) {
    return { $t: "typed", k: typed.kind, v: encodeBytes(typed.bytes) };
  }
  if (Array.isArray(value)) {
    return value.map((item) => encodeWireValue(item, seen));
  }
  if (isReactElementLike(value)) {
    return {
      $t: "element",
      ty: encodeType(value.type),
      props: encodeWireValue(value.props, seen),
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
    result[key] = encodeWireValue(item, seen);
  }
  return result;
}

export function decodeWireValue(
  value: unknown,
  resolveClientReference: (id: string) => unknown,
): unknown {
  if (typeof value !== "object" || value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => decodeWireValue(item, resolveClientReference));
  }

  const tagged = value as Record<string, unknown>;
  const tag = tagged.$t;
  if (typeof tag !== "string") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(tagged)) {
      result[key] = decodeWireValue(item, resolveClientReference);
    }
    return result;
  }

  switch (tag) {
    case "undef":
      return undefined;
    case "bigint":
      return BigInt(String(tagged.v));
    case "date":
      return new Date(String(tagged.v));
    case "search":
      return new URLSearchParams(String(tagged.v));
    case "arrayBuffer":
      return decodeBytes(String(tagged.v)).buffer;
    case "typed":
      return rehydrateTypedArray(String(tagged.k), decodeBytes(String(tagged.v)));
    case "map":
      return new Map(
        ((tagged.v as unknown[]) ?? []).map((pair) => {
          const tuple = (pair as unknown[]) ?? [];
          return [
            decodeWireValue(tuple[0], resolveClientReference),
            decodeWireValue(tuple[1], resolveClientReference),
          ];
        }),
      );
    case "set":
      return new Set(((tagged.v as unknown[]) ?? []).map((item) => decodeWireValue(item, resolveClientReference)));
    case "formdata": {
      const form = new FormData();
      for (const entry of (tagged.v as unknown[]) ?? []) {
        const [key, item] = (entry as unknown[]) ?? [];
        form.append(String(key), String(decodeWireValue(item, resolveClientReference)));
      }
      return form;
    }
    case "clientRef":
      return resolveClientReference(String(tagged.id));
    case "serverRef":
      return {
        $$typeof: SERVER_REFERENCE_SYMBOL,
        $$id: String(tagged.id),
        $$bound: null,
      };
    case "element": {
      const type = decodeType(tagged.ty as JsonObject, resolveClientReference);
      const props = decodeWireValue(tagged.props, resolveClientReference) as Record<string, unknown>;
      const key = tagged.key as string | null;
      return createElement(type as any, key == null ? props : { ...props, key });
    }
    default:
      throw new Error(`Unknown wire tag "${tag}"`);
  }
}
