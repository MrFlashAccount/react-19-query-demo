/**
 * Wire decoding: revives Flight wire format back to JS values.
 *
 * Two entry points: (1) parseModelString + createModelReviver for JSON.parse
 * reviver (streaming); (2) decodeWireValue for tagged JSON (encodeReply). We
 * mutate in-place for Maps/Sets to avoid allocations. Row refs track visited
 * ids to detect circular refs and fail fast.
 */
import { Fragment } from "react";
import type { JsonObject, StreamDecodeContext } from "./types";
import {
  CHR,
  EMPTY_ARRAY,
  REACT_ELEMENT_SYMBOL,
  REACT_LAZY_SYMBOL,
  SERVER_REFERENCE_SYMBOL,
  WIRE_TAG,
  WIRE_TAG_SENTINEL,
} from "./constants";
import { isFlightWireString, parseHexChunkId } from "./shared";
import {
  applyDirectPathReplacements as applyPathTreeReplacements,
  applyPathReplacements,
} from "./path-tree";

function decodeType(value: JsonObject, resolveClientReference: (id: number) => unknown): unknown {
  switch (value.$t) {
    case "host":
      return value.v as string;
    case "fragment":
      return Fragment;
    case "client":
      return resolveClientReference(value.id as number);
    default:
      throw new Error(`Unsupported encoded element type "${String(value.$t)}"`);
  }
}

/** Decodes element type from legacy { $t, v } or compact [sentinel, typeId, ...payload]. */
function decodeWireType(
  value: JsonObject | unknown[],
  resolveClientReference: (id: number) => unknown,
): unknown {
  if (Array.isArray(value) && value[0] === WIRE_TAG_SENTINEL) {
    const typeId = value[1];
    switch (typeId) {
      case WIRE_TAG.HOST:
        return value[2] as string;
      case WIRE_TAG.FRAGMENT:
        return Fragment;
      case WIRE_TAG.CLIENT_REF:
        return resolveClientReference(value[2] as number);
      default:
        throw new Error(`Unsupported compact element type id ${typeId as any}`);
    }
  }
  return decodeType(value as JsonObject, resolveClientReference);
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

/** Creates a server action stub; callServer is invoked when the stub is called. */
export function createServerReference(
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

/**
 * Revives a single $X string from the stream format. Dispatches on second char
 * (P=URLSearchParams, S=Symbol, C=client ref, K=FormData, F=server ref, L=lazy).
 * Plain strings pass through unchanged.
 */
export function parseModelString<Chunk>(
  context: StreamDecodeContext<Chunk>,
  value: string,
): unknown {
  if (!isFlightWireString(value)) {
    return value;
  }
  if (value.length === 1) {
    return value;
  }
  const type = value[1];
  switch (type) {
    case CHR.ELEMENT_PREFIX:
      return value.slice(1);
    case CHR.P:
      return new URLSearchParams(value.slice(2));
    case CHR.S:
      return Symbol.for(value.slice(2));
    case CHR.R: {
      const refId = parseHexChunkId(value.slice(2));
      return context.resolveClientReference(refId);
    }
    case CHR.K:
      return decodeFormDataFromChunk(context, value);
    case CHR.F:
      return decodeServerReferenceFromChunk(context, value);
    case CHR.L: {
      const id = parseHexChunkId(value.slice(2));
      return context.createLazyChunkWrapper(context.getChunk(id));
    }
    default: {
      const id = parseHexChunkId(value.slice(1));
      const chunk = context.getChunk(id);
      return context.createLazyChunkWrapper(chunk);
    }
  }
}

/** True if value is a Flight element tuple ["$", type, key, props]. Uses string check since JSON/structured-clone can't serialize symbols. */
function isElementTuple(value: unknown): value is [string, unknown, unknown, unknown] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    typeof value[0] === "string" &&
    value[0].length > 0 &&
    value[0] === CHR.ELEMENT_PREFIX
  );
}

function maybeDecodeElementTuple(value: unknown): unknown {
  if (!isElementTuple(value)) {
    return value;
  }

  return {
    $$typeof: REACT_ELEMENT_SYMBOL,
    type: value[1],
    key: value[2],
    ref: null,
    props: value[3],
  };
}

/** JSON.parse reviver that revives $X strings and decodes React element tuples. */
export function createModelReviver<Chunk>(
  context: StreamDecodeContext<Chunk>,
): (this: unknown, key: string, value: unknown) => unknown {
  return function modelReviver(_key: string, value: unknown): unknown {
    if (typeof value === "string") {
      return parseModelString(context, value);
    }
    return maybeDecodeElementTuple(value);
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
    for (const [k, v] of value.entries()) {
      value.delete(k);
      value.set(reviveModelValueTreeInternal(context, k), reviveModelValueTreeInternal(context, v));
    }
    return value;
  }
  if (value instanceof Set) {
    for (const item of value) {
      value.delete(item);
      value.add(reviveModelValueTreeInternal(context, item));
    }
    return value;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = reviveModelValueTreeInternal(context, value[i]);
    }
    return maybeDecodeElementTuple(value);
  }
  if (typeof value !== "object" || value == null) {
    return value;
  }
  const source = value as Record<string, unknown>;
  const keys = Object.keys(source);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    source[key] = reviveModelValueTreeInternal(context, source[key]);
  }
  return source;
}

/** Walks parsed JSON and revives all $X strings; mutates Maps/Sets in-place. */
export function reviveModelValueTree<Chunk>(
  context: StreamDecodeContext<Chunk>,
  parsedValue: unknown,
): unknown {
  return reviveModelValueTreeInternal(context, parsedValue);
}

function traverseElementTuplesOnlyInternal<Chunk>(
  value: unknown,
  context: StreamDecodeContext<Chunk>,
): unknown {
  if (value instanceof Date || typeof value === "bigint") {
    return value;
  }
  if (typeof value === "string") {
    if (isFlightWireString(value)) {
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
  if (isElementTuple(value)) {
    let type = value[1];
    if (typeof type === "string" && isFlightWireString(type)) {
      type = parseModelString(context, type);
    }
    const key = value[2];
    const rawProps = value[3];
    let props: Record<string, unknown>;
    if (Array.isArray(rawProps)) {
      props = { children: traverseElementTuplesOnlyInternal(rawProps, context) };
    } else {
      props = rawProps as Record<string, unknown>;
      const children = props.children;
      if (children !== undefined) {
        props.children = traverseElementTuplesOnlyInternal(children, context);
      }
    }
    return maybeDecodeElementTuple([CHR.ELEMENT_PREFIX, type, key, props]);
  }
  for (let i = 0; i < value.length; i += 1) {
    value[i] = traverseElementTuplesOnlyInternal(value[i], context);
  }
  return value;
}

/**
 * Revives only $X strings inside React element tuples, not the whole tree.
 * Used when we want to defer full revival until chunks resolve (lazy streaming).
 */
export function traverseElementTuplesOnly<Chunk>(
  context: StreamDecodeContext<Chunk>,
  parsedValue: unknown,
): unknown {
  return traverseElementTuplesOnlyInternal(parsedValue, context);
}

/** Wraps an unresolved chunk as React.lazy payload; _init is called when React suspends to read it. */
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

/**
 * Applies revive paths to a parsed model: only revives strings at the given paths
 * instead of walking the whole tree.
 */
export function applyDirectPathReplacements<Chunk>(
  root: unknown,
  revivePathsOrTree: import("./path-tree").RevivePathTree | ReadonlyArray<(string | number)[]>,
  context: StreamDecodeContext<Chunk>,
): void {
  applyPathTreeReplacements(root, revivePathsOrTree, (raw) =>
    parseModelString(context, raw as string),
  );
}

function isCompactWireTagged(value: unknown): value is [string, number, ...unknown[]] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value[0] === WIRE_TAG_SENTINEL &&
    typeof value[1] === "number"
  );
}

function isTaggedWireValue(value: unknown): value is [string, number, ...unknown[]] {
  return isCompactWireTagged(value);
}

/**
 * Decodes tagged JSON wire format (encodeReply output). resolveRowReference
 * resolves $t: "rowRef" to binary/outlined values. visitingRowRefs prevents
 * circular refs from causing infinite recursion. When revivePaths is provided,
 * only visits those paths and decodes tagged values (avoids full traversal).
 */
export function decodeWireValue(
  value: unknown,
  resolveClientReference: (id: number) => unknown,
  resolveRowReference?: (id: string) => unknown,
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>,
  traceOptions?: {
    currentRowId?: number;
    revivePaths?: ReadonlyArray<(string | number)[]>;
  },
): unknown {
  const revivePaths = traceOptions?.revivePaths;
  if (revivePaths != null && revivePaths.length > 0) {
    const visitingRowRefs = new Set<string>();
    const reviver = (v: unknown): unknown => {
      if (!isTaggedWireValue(v)) return v;
      return decodeTaggedWireValue(
        v,
        resolveClientReference,
        resolveRowReference,
        callServer,
        visitingRowRefs,
        traceOptions?.currentRowId,
      );
    };
    const hasRootPath = revivePaths.some((p) => p.length === 0);
    const nonRootPaths = revivePaths.filter((p) => p.length > 0);
    if (nonRootPaths.length > 0) {
      applyPathReplacements(value, nonRootPaths, reviver);
    }
    if (hasRootPath && isTaggedWireValue(value)) {
      return reviver(value);
    }
    return value;
  }
  return decodeWireValueInternal(
    value,
    resolveClientReference,
    resolveRowReference,
    callServer,
    new Set<string>(),
    traceOptions?.currentRowId,
  );
}

function decodeWireValueInternal(
  value: unknown,
  resolveClientReference: (id: number) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
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
      currentRowId,
    );
  }
  if (value instanceof Map) {
    const mapped = new Map<unknown, unknown>();
    for (const [key, item] of value.entries()) {
      mapped.set(
        decodeWireValueInternal(
          key,
          resolveClientReference,
          resolveRowReference,
          callServer,
          visitingRowRefs,
          currentRowId,
        ),
        decodeWireValueInternal(
          item,
          resolveClientReference,
          resolveRowReference,
          callServer,
          visitingRowRefs,
          currentRowId,
        ),
      );
    }
    return mapped;
  }
  if (value instanceof Set) {
    const decoded = new Set<unknown>();
    for (const item of value) {
      decoded.add(
        decodeWireValueInternal(
          item,
          resolveClientReference,
          resolveRowReference,
          callServer,
          visitingRowRefs,
          currentRowId,
        ),
      );
    }
    return decoded;
  }

  if (isCompactWireTagged(value)) {
    return decodeTaggedWireValue(
      value,
      resolveClientReference,
      resolveRowReference,
      callServer,
      visitingRowRefs,
      currentRowId,
    );
  }

  return value;
}

function decodeWireArrayValue(
  value: unknown[],
  resolveClientReference: (id: number) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
  currentRowId: number | undefined,
): unknown[] {
  for (let i = 0; i < value.length; i += 1) {
    value[i] = decodeWireValueInternal(
      value[i],
      resolveClientReference,
      resolveRowReference,
      callServer,
      visitingRowRefs,
      currentRowId,
    );
  }
  return value;
}

function decodeWireRowReferenceValue(
  value: Record<string, unknown>,
  resolveClientReference: (id: number) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
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
      currentRowId,
    );
  } finally {
    visitingRowRefs.delete(rowId);
  }
}

function decodeWireFormDataValue(
  value: Record<string, unknown>,
  resolveClientReference: (id: number) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
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
  resolveClientReference: (id: number) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
  currentRowId: number | undefined,
): {
  $$typeof: symbol;
  type: unknown;
  key: string | null;
  ref: null;
  props: Record<string, unknown>;
} {
  const type = decodeWireType(value.ty as JsonObject | unknown[], resolveClientReference);
  const props = decodeWireValueInternal(
    value.props,
    resolveClientReference,
    resolveRowReference,
    callServer,
    visitingRowRefs,
    currentRowId,
  ) as Record<string, unknown>;
  const key = value.key as string | null;
  return {
    $$typeof: REACT_ELEMENT_SYMBOL,
    type,
    key: key == null ? null : key,
    ref: null,
    props,
  };
}

function decodeTaggedWireValue(
  value: [string, number, ...unknown[]],
  resolveClientReference: (id: number) => unknown,
  resolveRowReference: ((id: string) => unknown) | undefined,
  callServer: ((actionId: string, args: unknown[]) => Promise<unknown>) | undefined,
  visitingRowRefs: Set<string>,
  currentRowId: number | undefined,
): unknown {
  const typeId = value[1];
  const payload = value.slice(2);
  switch (typeId) {
    case WIRE_TAG.SEARCH:
      return new URLSearchParams(payload[0] as string);
    case WIRE_TAG.ROW_REF: {
      const rowRef = { $t: "rowRef", id: payload[0] };
      return decodeWireRowReferenceValue(
        rowRef,
        resolveClientReference,
        resolveRowReference,
        callServer,
        visitingRowRefs,
        currentRowId,
      );
    }
    case WIRE_TAG.CLIENT_REF:
      return resolveClientReference(payload[0] as number);
    case WIRE_TAG.SERVER_REF:
      return createServerReference(payload[0] as string, callServer);
    case WIRE_TAG.FORMDATA: {
      const formRef = { $t: "formdata", v: payload[0] };
      return decodeWireFormDataValue(
        formRef,
        resolveClientReference,
        resolveRowReference,
        callServer,
        visitingRowRefs,
        currentRowId,
      );
    }
    case WIRE_TAG.ELEMENT: {
      const elemRef = {
        ty: payload[0],
        props: payload[1],
        key: payload[2],
      };
      return decodeWireElementValue(
        elemRef,
        resolveClientReference,
        resolveRowReference,
        callServer,
        visitingRowRefs,
        currentRowId,
      );
    }
    default:
      throw new Error(`Unknown wire type id ${typeId}`);
  }
}
