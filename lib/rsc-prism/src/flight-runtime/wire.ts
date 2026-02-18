import { createElement, Fragment, isValidElement } from "react";

const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
const SERVER_REFERENCE_SYMBOL = Symbol.for("react.server.reference");
const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
const LEGACY_REACT_ELEMENT_SYMBOL = Symbol.for("react.element");
const REACT_FRAGMENT_SYMBOL = Symbol.for("react.fragment");

type JsonObject = Record<string, unknown>;
const EMPTY_ARRAY: unknown[] = [];
const BINARY_ARRAY_BUFFER_TAG = "arrayBufferBinary";
const BINARY_TYPED_TAG = "typedBinary";

type EmitBinaryRow = (kind: string, bytes: Uint8Array) => string | number;

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
    return { kind: "Uint8ClampedArray", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  if (value instanceof Int16Array)
    return { kind: "Int16Array", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  if (value instanceof Uint16Array)
    return { kind: "Uint16Array", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  if (value instanceof Int32Array)
    return { kind: "Int32Array", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  if (value instanceof Uint32Array)
    return { kind: "Uint32Array", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  if (value instanceof Float32Array)
    return { kind: "Float32Array", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  if (value instanceof Float64Array)
    return { kind: "Float64Array", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  if (value instanceof BigInt64Array)
    return { kind: "BigInt64Array", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  if (value instanceof BigUint64Array)
    return { kind: "BigUint64Array", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  if (value instanceof DataView)
    return { kind: "DataView", bytes: toBytes(value.buffer, value.byteOffset, value.byteLength) };
  return null;
}

function rehydrateTypedArray(kind: string, bytes: Uint8Array): unknown {
  const toCopiedBuffer = (): ArrayBuffer =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
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
): unknown {
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
    throw new Error(
      "Binary values are not supported in JSON wire mode. Use encodeWireValueWithBinaryRows/encodeReply.",
    );
  }
  const typed = normalizeTypedArray(value);
  if (typed != null) {
    throw new Error(
      "Binary values are not supported in JSON wire mode. Use encodeWireValueWithBinaryRows/encodeReply.",
    );
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

export function encodeWireValueWithBinaryRows(
  value: unknown,
  emitBinaryRow: EmitBinaryRow,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
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
      entries.push([key, encodeWireValueWithBinaryRows(item, emitBinaryRow, seen)]);
    }
    return { $t: "formdata", v: entries };
  }
  if (value instanceof Map) {
    return {
      $t: "map",
      v: Array.from(value.entries()).map(([key, item]) => [
        encodeWireValueWithBinaryRows(key, emitBinaryRow, seen),
        encodeWireValueWithBinaryRows(item, emitBinaryRow, seen),
      ]),
    };
  }
  if (value instanceof Set) {
    return {
      $t: "set",
      v: Array.from(value.values()).map((item) => encodeWireValueWithBinaryRows(item, emitBinaryRow, seen)),
    };
  }
  if (value instanceof ArrayBuffer) {
    return { $t: "rowRef", id: emitBinaryRow("ArrayBuffer", new Uint8Array(value)) };
  }
  const typed = normalizeTypedArray(value);
  if (typed != null) {
    return { $t: "rowRef", id: emitBinaryRow(typed.kind, typed.bytes) };
  }
  if (Array.isArray(value)) {
    return value.map((item) => encodeWireValueWithBinaryRows(item, emitBinaryRow, seen));
  }
  if (isReactElementLike(value)) {
    return {
      $t: "element",
      ty: encodeType(value.type),
      props: encodeWireValueWithBinaryRows(value.props, emitBinaryRow, seen),
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
    result[key] = encodeWireValueWithBinaryRows(item, emitBinaryRow, seen);
  }
  return result;
}

export function decodeBinaryWireRow(tag: string, bytes: Uint8Array): unknown {
  switch (tag) {
    case "A":
      return { $t: BINARY_ARRAY_BUFFER_TAG, v: bytes };
    case "o":
      return { $t: BINARY_TYPED_TAG, k: "Uint8Array", v: bytes };
    case "O":
      return { $t: BINARY_TYPED_TAG, k: "Int8Array", v: bytes };
    case "U":
      return { $t: BINARY_TYPED_TAG, k: "Uint8ClampedArray", v: bytes };
    case "S":
      return { $t: BINARY_TYPED_TAG, k: "Int16Array", v: bytes };
    case "s":
      return { $t: BINARY_TYPED_TAG, k: "Uint16Array", v: bytes };
    case "L":
      return { $t: BINARY_TYPED_TAG, k: "Int32Array", v: bytes };
    case "l":
      return { $t: BINARY_TYPED_TAG, k: "Uint32Array", v: bytes };
    case "G":
      return { $t: BINARY_TYPED_TAG, k: "Float32Array", v: bytes };
    case "g":
      return { $t: BINARY_TYPED_TAG, k: "Float64Array", v: bytes };
    case "M":
      return { $t: BINARY_TYPED_TAG, k: "BigInt64Array", v: bytes };
    case "m":
      return { $t: BINARY_TYPED_TAG, k: "BigUint64Array", v: bytes };
    case "V":
      return { $t: BINARY_TYPED_TAG, k: "DataView", v: bytes };
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

function decodeTagValue(tagged: Record<string, unknown>): unknown {
  const tag = tagged.$t;
  if (typeof tag !== "string") {
    return null;
  }
  if (tag === BINARY_ARRAY_BUFFER_TAG) {
    const bytes = tagged.v;
    if (!(bytes instanceof Uint8Array)) {
      throw new Error("Invalid binary arrayBuffer payload.");
    }
    if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
      return bytes.buffer;
    }
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  if (tag === BINARY_TYPED_TAG) {
    const kind = typeof tagged.k === "string" ? tagged.k : String(tagged.k);
    const bytes = tagged.v;
    if (!(bytes instanceof Uint8Array)) {
      throw new Error("Invalid binary typed payload.");
    }
    return rehydrateTypedArray(kind, bytes);
  }
  return null;
}

export function decodeWireValue(
  value: unknown,
  resolveClientReference: (id: string) => unknown,
  resolveRowReference?: (id: string) => unknown,
): unknown {
  return decodeWireValueInternal(value, resolveClientReference, resolveRowReference, new Set<string>());
}

function decodeWireValueInternal(
  value: unknown,
  resolveClientReference: (id: string) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  visitingRowRefs: Set<string>,
): unknown {
  if (typeof value !== "object" || value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    const decoded: unknown[] = [];
    for (let i = 0; i < value.length; i += 1) {
      decoded.push(
        decodeWireValueInternal(value[i], resolveClientReference, resolveRowReference, visitingRowRefs),
      );
    }
    return decoded;
  }

  const tagged = value as Record<string, unknown>;
  const decodedBinary = decodeTagValue(tagged);
  if (decodedBinary != null) {
    return decodedBinary;
  }

  const tag = tagged.$t;
  if (typeof tag !== "string") {
    const result: Record<string, unknown> = {};
    for (const key in tagged) {
      if (Object.prototype.hasOwnProperty.call(tagged, key)) {
        result[key] = decodeWireValueInternal(
          tagged[key],
          resolveClientReference,
          resolveRowReference,
          visitingRowRefs,
        );
      }
    }
    return result;
  }

  switch (tag) {
    case "rowRef": {
      if (resolveRowReference == null) {
        throw new Error(`Unknown wire tag "${tag}"`);
      }
      const rowId = typeof tagged.id === "string" ? tagged.id : String(tagged.id);
      if (visitingRowRefs.has(rowId)) {
        throw new Error(`[rsc-prism] Circular row reference "${rowId}" in Flight payload.`);
      }
      visitingRowRefs.add(rowId);
      try {
        const rowValue = resolveRowReference(rowId);
        if (rowValue == null) {
          throw new Error(`[rsc-prism] Missing row "${rowId}" in Flight payload.`);
        }
        return decodeWireValueInternal(
          rowValue,
          resolveClientReference,
          resolveRowReference,
          visitingRowRefs,
        );
      } finally {
        visitingRowRefs.delete(rowId);
      }
    }
    case "undef":
      return undefined;
    case "bigint":
      return BigInt(typeof tagged.v === "string" ? tagged.v : String(tagged.v));
    case "date":
      return new Date(typeof tagged.v === "string" ? tagged.v : String(tagged.v));
    case "search":
      return new URLSearchParams(typeof tagged.v === "string" ? tagged.v : String(tagged.v));
    case "map": {
      const entries = (tagged.v as unknown[] | null | undefined) ?? EMPTY_ARRAY;
      if (!Array.isArray(entries)) {
        return new Map(
          (entries as unknown[]).map((pair) => {
            const tuple = (pair as { [index: number]: unknown } | null | undefined) ?? [];
            return [
              decodeWireValueInternal(
                tuple[0],
                resolveClientReference,
                resolveRowReference,
                visitingRowRefs,
              ),
              decodeWireValueInternal(
                tuple[1],
                resolveClientReference,
                resolveRowReference,
                visitingRowRefs,
              ),
            ];
          }),
        );
      }
      const mapped: Array<[unknown, unknown]> = [];
      for (let i = 0; i < entries.length; i += 1) {
        const tuple = (entries[i] as { [index: number]: unknown } | null | undefined) ?? [];
        mapped.push([
          decodeWireValueInternal(tuple[0], resolveClientReference, resolveRowReference, visitingRowRefs),
          decodeWireValueInternal(tuple[1], resolveClientReference, resolveRowReference, visitingRowRefs),
        ]);
      }
      return new Map(mapped);
    }
    case "set": {
      const items = (tagged.v as unknown[] | null | undefined) ?? EMPTY_ARRAY;
      if (!Array.isArray(items)) {
        return new Set(
          (items as unknown[]).map((item) =>
            decodeWireValueInternal(item, resolveClientReference, resolveRowReference, visitingRowRefs),
          ),
        );
      }
      const decoded: unknown[] = [];
      for (let i = 0; i < items.length; i += 1) {
        decoded.push(
          decodeWireValueInternal(items[i], resolveClientReference, resolveRowReference, visitingRowRefs),
        );
      }
      return new Set(decoded);
    }
    case "formdata": {
      const entries = (tagged.v as unknown[] | null | undefined) ?? EMPTY_ARRAY;
      if (!Array.isArray(entries)) {
        const form = new FormData();
        for (const entry of entries as unknown[]) {
          const tuple = (entry as { [index: number]: unknown } | null | undefined) ?? [];
          const key = tuple[0];
          const item = tuple[1];
          const decoded = decodeWireValueInternal(
            item,
            resolveClientReference,
            resolveRowReference,
            visitingRowRefs,
          );
          form.append(
            typeof key === "string" ? key : String(key),
            typeof decoded === "string" ? decoded : String(decoded),
          );
        }
        return form;
      }
      const form = new FormData();
      for (let i = 0; i < entries.length; i += 1) {
        const tuple = (entries[i] as { [index: number]: unknown } | null | undefined) ?? [];
        const key = tuple[0];
        const item = tuple[1];
        const decoded = decodeWireValueInternal(item, resolveClientReference, resolveRowReference, visitingRowRefs);
        form.append(
          typeof key === "string" ? key : String(key),
          typeof decoded === "string" ? decoded : String(decoded),
        );
      }
      return form;
    }
    case "clientRef":
      return resolveClientReference(typeof tagged.id === "string" ? tagged.id : String(tagged.id));
    case "serverRef":
      return {
        $$typeof: SERVER_REFERENCE_SYMBOL,
        $$id: typeof tagged.id === "string" ? tagged.id : String(tagged.id),
        $$bound: null,
      };
    case "element": {
      const type = decodeType(tagged.ty as JsonObject, resolveClientReference);
      const props = decodeWireValueInternal(
        tagged.props,
        resolveClientReference,
        resolveRowReference,
        visitingRowRefs,
      ) as Record<string, unknown>;
      const key = tagged.key as string | null;
      return createElement(type as any, key == null ? props : { ...props, key });
    }
    default:
      throw new Error(`Unknown wire tag "${tag}"`);
  }
}
