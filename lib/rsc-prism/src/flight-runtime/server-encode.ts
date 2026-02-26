/**
 * Server-side Flight encoding: React tree to wire format.
 *
 * Handles template compaction, encode context, and server node encoding.
 */

import type {
  FlightRowMessage,
  FlightTemplateRowShape,
  MutablePathTree,
  RevivePathTree,
  StreamEncodeContext,
} from "./wire";
import {
  binaryWireTagFromKind,
  finalizePathTree,
  pushPathToTree,
  encodeStreamType,
  encodeStreamValue,
} from "./wire";
import { REACT_FRAGMENT_SYMBOL } from "./wire/constants";
import { isClientReference, isPlainObject, isReactElementLike } from "./wire/shared";

const TEMPLATE_SLOT_KEY = "$slot";
const TEMPLATE_REF_KEY = "$tpl";
const TEMPLATE_VALUES_KEY = "$v";
const TEMPLATE_MIN_ARRAY_ITEMS = 8;
const TEMPLATE_MIN_INPUT_BYTES = 2048;
const TEMPLATE_MIN_BYTES_SAVED = 256;
const TEMPLATE_MIN_SAVINGS_RATIO = 0.12;
const TEMPLATE_MAX_SLOT_COUNT = 64;
const TEMPLATE_MAX_TEMPLATES_PER_ROW = 8;
const TEMPLATE_MAX_VISITED_NODES = 6000;

const PATH_KEY_SEP = "\x00";

/** Cheap path key; avoids JSON.stringify for (string|number)[]. */
function pathToKey(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) return "";
  if (path.length === 1) return String(path[0]);
  let out = String(path[0]);
  for (let i = 1; i < path.length; i += 1) {
    out += PATH_KEY_SEP + String(path[i]);
  }
  return out;
}

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
  emitMetadataRow?: (
    id: number,
    revivePaths: RevivePathTree | ReadonlyArray<(string | number)[]>,
    templates?: FlightTemplateRowShape[],
  ) => void;
  emitBinaryRow: (id: number, kind: string, bytes: Uint8Array) => void;
}

export interface CreateEncodeContextOptions {
  /** When true (default), skip template compaction and path tree for faster encode. */
  fastMode?: boolean;
}

export interface EncodeContext {
  queueDeferred: (task: Promise<void>) => void;
  allocateRowId: () => number;
  emitRow: (id: number, value: unknown) => void;
  emitBinaryRow: (kind: string, bytes: Uint8Array) => number;
  outlineValue: (value: unknown) => number;
  streamEncodeContext: StreamEncodeContext;
  preparePathsForEncode: () => void;
}

/** Single-pass traversal: collects candidate arrays as (path, node) to avoid getValueAtPath. */
function collectTemplateCandidates(
  node: unknown,
  path: (string | number)[],
  out: Array<{ path: (string | number)[]; node: unknown[] }>,
  limits: { visitedNodes: number },
): void {
  limits.visitedNodes += 1;
  if (
    limits.visitedNodes > TEMPLATE_MAX_VISITED_NODES ||
    out.length >= TEMPLATE_MAX_TEMPLATES_PER_ROW
  ) {
    return;
  }

  if (Array.isArray(node)) {
    const first = node[0];
    if (
      node.length >= TEMPLATE_MIN_ARRAY_ITEMS &&
      Array.isArray(first) &&
      first.length === 4 &&
      first[0] === "$" &&
      node.every((entry) => Array.isArray(entry) && entry.length === 4 && entry[0] === "$")
    ) {
      out.push({ path: [...path], node });
    }
    for (let i = 0; i < node.length; i += 1) {
      path.push(i);
      collectTemplateCandidates(node[i], path, out, limits);
      path.pop();
    }
    return;
  }
  if (!isPlainObject(node)) {
    return;
  }
  const keys = Object.keys(node);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    path.push(key);
    collectTemplateCandidates(node[key], path, out, limits);
    path.pop();
  }
}

function compareStructureAndCollectDiffPaths(
  base: unknown,
  value: unknown,
  path: (string | number)[],
  varying: Set<string>,
): boolean {
  if (typeof base !== typeof value) {
    return false;
  }
  if (base == null || value == null || typeof base !== "object") {
    if (!Object.is(base, value)) {
      varying.add(pathToKey(path));
    }
    return true;
  }
  if (Array.isArray(base) || Array.isArray(value)) {
    if (!Array.isArray(base) || !Array.isArray(value) || base.length !== value.length) {
      return false;
    }
    for (let i = 0; i < base.length; i += 1) {
      if (!compareStructureAndCollectDiffPaths(base[i], value[i], [...path, i], varying)) {
        return false;
      }
    }
    return true;
  }
  if (!isPlainObject(base) || !isPlainObject(value)) {
    return false;
  }
  const baseKeys = Object.keys(base);
  const valueKeys = Object.keys(value);
  if (baseKeys.length !== valueKeys.length) {
    return false;
  }
  for (let i = 0; i < baseKeys.length; i += 1) {
    if (baseKeys[i] !== valueKeys[i]) {
      return false;
    }
  }
  for (let i = 0; i < baseKeys.length; i += 1) {
    const key = baseKeys[i];
    if (!compareStructureAndCollectDiffPaths(base[key], value[key], [...path, key], varying)) {
      return false;
    }
  }
  return true;
}

type SigFrame =
  | { k: "val"; v: unknown }
  | { k: "arr"; a: unknown[]; r: string[] }
  | { k: "obj"; o: Record<string, unknown>; keys: string[]; r: string[] };

/** Iterative structure signature to avoid deep recursion; used for template grouping. */
function buildStructureSignature(
  value: unknown,
  scratch?: { stack: SigFrame[]; out: string[] },
): string {
  const stack = scratch?.stack ?? [];
  const out = scratch?.out ?? [];
  stack.length = 0;
  out.length = 0;
  stack.push({ k: "val", v: value });

  while (stack.length > 0) {
    const f = stack.pop()!;
    if (f.k === "val") {
      const v = f.v;
      if (v == null) {
        out.push("null");
        continue;
      }
      const t = typeof v;
      if (t !== "object") {
        out.push(t);
        continue;
      }
      if (Array.isArray(v)) {
        if (v.length === 0) {
          out.push("[]");
          continue;
        }
        stack.push({ k: "arr", a: v, r: [] });
        for (let i = v.length - 1; i >= 0; i -= 1) {
          stack.push({ k: "val", v: v[i] });
        }
        continue;
      }
      if (!isPlainObject(v)) {
        out.push(`{${Object.prototype.toString.call(v)}}`);
        continue;
      }
      const keys = Object.keys(v);
      if (keys.length === 0) {
        out.push("{}");
        continue;
      }
      stack.push({ k: "obj", o: v as Record<string, unknown>, keys, r: [] });
      for (let i = keys.length - 1; i >= 0; i -= 1) {
        stack.push({ k: "val", v: (v as Record<string, unknown>)[keys[i]] });
      }
      continue;
    }
    if (f.k === "arr") {
      const n = f.a.length;
      for (let i = 0; i < n; i += 1) {
        f.r.push(out.pop()!);
      }
      f.r.reverse();
      out.push(`[${f.r.join(",")}]`);
      continue;
    }
    const n = f.keys.length;
    for (let i = 0; i < n; i += 1) {
      f.r.push(out.pop()!);
    }
    f.r.reverse();
    const pairs: string[] = [];
    for (let i = 0; i < n; i += 1) {
      pairs.push(`${f.keys[i]}:${f.r[i]}`);
    }
    out.push(`{${pairs.join(",")}}`);
  }
  return out[0] ?? "null";
}

/** Approximate serialized byte size without JSON.stringify. */
function estimateSerializedSize(value: unknown): number {
  if (value === null) return 4;
  if (value === undefined) return 9;
  const t = typeof value;
  if (t === "string") return (value as string).length + 2;
  if (t === "number" || t === "boolean") return 12;
  if (Array.isArray(value)) {
    let n = 2;
    for (let i = 0; i < value.length; i += 1) {
      n += estimateSerializedSize(value[i]) + 1;
    }
    return n;
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    let n = 2;
    for (let i = 0; i < keys.length; i += 1) {
      n += keys[i].length + 4 + estimateSerializedSize(obj[keys[i]]);
    }
    return n;
  }
  return 8;
}

function cloneWithSlotMarkers(
  node: unknown,
  path: (string | number)[],
  varying: Set<string>,
  pathToSlot: Map<string, number>,
  slots: unknown[],
): unknown {
  const pathKey = pathToKey(path);
  if (varying.has(pathKey)) {
    let idx = pathToSlot.get(pathKey);
    if (idx == null) {
      idx = pathToSlot.size;
      pathToSlot.set(pathKey, idx);
    }
    slots[idx] = node;
    return { [TEMPLATE_SLOT_KEY]: idx };
  }
  if (node == null || typeof node !== "object") {
    return node;
  }
  if (Array.isArray(node)) {
    const out = Array.from({ length: node.length });
    for (let i = 0; i < node.length; i += 1) {
      path.push(i);
      out[i] = cloneWithSlotMarkers(node[i], path, varying, pathToSlot, slots);
      path.pop();
    }
    return out;
  }
  if (!isPlainObject(node)) {
    return node;
  }
  const out: Record<string, unknown> = {};
  const keys = Object.keys(node);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    path.push(key);
    out[key] = cloneWithSlotMarkers(node[key], path, varying, pathToSlot, slots);
    path.pop();
  }
  return out;
}

function tryCompactArrayWithTemplate(
  items: unknown[],
  indices: number[],
  templateId: number,
): {
  template: FlightTemplateRowShape;
  replacements: Array<{ index: number; value: unknown }>;
  bytesSaved: number;
} | null {
  if (indices.length < TEMPLATE_MIN_ARRAY_ITEMS) {
    return null;
  }
  const base = items[indices[0]];
  const varyingPaths = new Set<string>();
  for (let i = 1; i < indices.length; i += 1) {
    if (!compareStructureAndCollectDiffPaths(base, items[indices[i]], [], varyingPaths)) {
      return null;
    }
  }
  if (varyingPaths.size === 0) {
    return null;
  }

  const pathToSlot = new Map<string, number>();
  const baseSlots: unknown[] = [];
  const shape = cloneWithSlotMarkers(base, [], varyingPaths, pathToSlot, baseSlots);
  if (pathToSlot.size === 0) {
    return null;
  }
  if (pathToSlot.size > TEMPLATE_MAX_SLOT_COUNT) {
    return null;
  }

  const replacements: Array<{ index: number; value: unknown }> = [];
  for (let i = 0; i < indices.length; i += 1) {
    const itemIndex = indices[i];
    const slots: unknown[] = [];
    cloneWithSlotMarkers(items[itemIndex], [], varyingPaths, pathToSlot, slots);
    replacements.push({
      index: itemIndex,
      value: { [TEMPLATE_REF_KEY]: templateId, [TEMPLATE_VALUES_KEY]: slots },
    });
  }

  let beforeSize = 0;
  let refsSize = 0;
  for (let i = 0; i < indices.length; i += 1) {
    beforeSize += estimateSerializedSize(items[indices[i]]);
    refsSize += estimateSerializedSize(replacements[i].value);
  }
  if (beforeSize < TEMPLATE_MIN_INPUT_BYTES) {
    return null;
  }
  const metadataSize = estimateSerializedSize([{ id: templateId, shape }]);
  const afterSize = metadataSize + refsSize;
  const bytesSaved = beforeSize - afterSize;
  if (
    bytesSaved < TEMPLATE_MIN_BYTES_SAVED ||
    bytesSaved / beforeSize < TEMPLATE_MIN_SAVINGS_RATIO
  ) {
    return null;
  }

  return {
    template: { id: templateId, shape },
    replacements,
    bytesSaved,
  };
}

function compactRowValueTemplates(value: unknown): {
  value: unknown;
  templates: FlightTemplateRowShape[];
} {
  const candidates: Array<{ path: (string | number)[]; node: unknown[] }> = [];
  collectTemplateCandidates(value, [], candidates, { visitedNodes: 0 });
  if (candidates.length === 0) {
    return { value, templates: [] };
  }

  let nextTemplateId = 0;
  const templates: FlightTemplateRowShape[] = [];
  const sigScratch = { stack: [] as SigFrame[], out: [] as string[] };
  for (let i = 0; i < candidates.length; i += 1) {
    const { node } = candidates[i];
    const groups = new Map<string, number[]>();
    for (let j = 0; j < node.length; j += 1) {
      const signature = buildStructureSignature(node[j], sigScratch);
      const group = groups.get(signature);
      if (group == null) {
        groups.set(signature, [j]);
      } else {
        group.push(j);
      }
    }

    const groupEntries = Array.from(groups.values()).sort((a, b) => b.length - a.length);
    let mutated = false;

    for (let g = 0; g < groupEntries.length; g += 1) {
      if (templates.length >= TEMPLATE_MAX_TEMPLATES_PER_ROW) {
        break;
      }
      const indices = groupEntries[g];
      if (indices.length < TEMPLATE_MIN_ARRAY_ITEMS) {
        continue;
      }
      const compacted = tryCompactArrayWithTemplate(node, indices, nextTemplateId);
      if (compacted == null) {
        continue;
      }
      for (let r = 0; r < compacted.replacements.length; r += 1) {
        const { index, value: replacementValue } = compacted.replacements[r];
        node[index] = replacementValue;
      }
      templates.push(compacted.template);
      nextTemplateId += 1;
      mutated = true;
    }

    if (!mutated) {
      continue;
    }
  }

  return { value, templates };
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
    const renderedValue = type(value.props);
    if (isThenable(renderedValue)) {
      return renderedValue.then(
        (resolvedValue) => encodeServerNode(resolvedValue, context, path),
        (error) => {
          throw error;
        },
      );
    }
    return encodeServerNode(renderedValue, context, path);
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
    return ["$", type, key, props];
  };

  if (hasAsync) {
    return Promise.all(encoded).then(
      (values) => buildRow(values),
      (error) => {
        throw error;
      },
    );
  }

  return buildRow(encoded);
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
  options: CreateEncodeContextOptions,
): EncodeContext {
  const fastMode = options.fastMode || true;
  let nextRowId = 1;
  const outlinedByValue = new Map<string, number>();
  const currentRevivePathTreeRef: { current: MutablePathTree } = { current: new Map() };
  const currentRevivePathsRef: { current: (string | number)[][] } = { current: [] };
  const context: EncodeContext = {
    queueDeferred,
    allocateRowId: () => {
      const current = nextRowId;
      nextRowId += 1;
      return current;
    },
    emitRow: (id, value) => {
      if (sink.settled) return;
      if (fastMode) {
        const paths = currentRevivePathsRef.current;
        const hasPaths = paths.length > 0;
        if (hasPaths && sink.emitMetadataRow) {
          sink.emitMetadataRow(id, paths);
        }
        sink.emitModelRow(id, value);
        currentRevivePathsRef.current = [];
      } else {
        const compacted = compactRowValueTemplates(value);
        const tree = currentRevivePathTreeRef.current;
        const hasPaths = tree.size > 0;
        if ((hasPaths || compacted.templates.length > 0) && sink.emitMetadataRow) {
          sink.emitMetadataRow(id, finalizePathTree(tree), compacted.templates);
        }
        sink.emitModelRow(id, compacted.value);
        currentRevivePathTreeRef.current = new Map();
      }
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
      currentRowId: undefined,
      pushReviveValue: (_encoded, path) => {
        if (fastMode) {
          currentRevivePathsRef.current.push(path);
        } else {
          pushPathToTree(currentRevivePathTreeRef.current, path);
        }
      },
    },
    preparePathsForEncode: () => {
      if (fastMode) {
        currentRevivePathsRef.current = [];
      } else {
        currentRevivePathTreeRef.current = new Map();
      }
    },
  };
  return context;
}

export { encodeServerNode };
