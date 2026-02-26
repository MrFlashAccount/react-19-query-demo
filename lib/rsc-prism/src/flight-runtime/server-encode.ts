/**
 * Server-side Flight encoding: React tree to wire format.
 *
 * Handles template compaction, encode context, and server node encoding.
 */

import type {
  FlightRowMessage,
  FlightTemplateRowShape,
  RevivePathTree,
  StreamEncodeContext,
} from "./wire";
import { binaryWireTagFromKind, pathsToTree, encodeStreamType, encodeStreamValue } from "./wire";
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
    revivePathTree: RevivePathTree,
    templates?: FlightTemplateRowShape[],
  ) => void;
  emitBinaryRow: (id: number, kind: string, bytes: Uint8Array) => void;
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

function collectTemplateCandidatePaths(
  node: unknown,
  path: (string | number)[],
  out: (string | number)[][],
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
      out.push([...path]);
    }
    for (let i = 0; i < node.length; i += 1) {
      path.push(i);
      collectTemplateCandidatePaths(node[i], path, out, limits);
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
    collectTemplateCandidatePaths(node[key], path, out, limits);
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
      varying.add(JSON.stringify(path));
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

function buildStructureSignature(value: unknown): string {
  if (value == null) {
    return "null";
  }
  const type = typeof value;
  if (type !== "object") {
    return type;
  }
  if (Array.isArray(value)) {
    const parts = Array.from({ length: value.length });
    for (let i = 0; i < value.length; i += 1) {
      parts[i] = buildStructureSignature(value[i]);
    }
    return `[${parts.join(",")}]`;
  }
  if (!isPlainObject(value)) {
    return `{${Object.prototype.toString.call(value)}}`;
  }
  const keys = Object.keys(value);
  const parts = Array.from({ length: keys.length });
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    parts[i] = `${key}:${buildStructureSignature(value[key])}`;
  }
  return `{${parts.join(",")}}`;
}

function getValueAtPath(root: unknown, path: (string | number)[]): unknown {
  let current = root;
  for (let i = 0; i < path.length; i += 1) {
    const seg = path[i];
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[String(seg)];
  }
  return current;
}

function setValueAtPath(root: unknown, path: (string | number)[], value: unknown): boolean {
  if (path.length === 0) return false;
  let current = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const seg = path[i];
    if (current == null || typeof current !== "object") {
      return false;
    }
    current = (current as Record<string, unknown>)[String(seg)];
  }
  if (current == null || typeof current !== "object") {
    return false;
  }
  (current as Record<string, unknown>)[String(path[path.length - 1])] = value;
  return true;
}

function cloneWithSlotMarkers(
  node: unknown,
  path: (string | number)[],
  varying: Set<string>,
  pathToSlot: Map<string, number>,
  slots: unknown[],
): unknown {
  const pathKey = JSON.stringify(path);
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
    beforeSize += JSON.stringify(items[indices[i]]).length;
    refsSize += JSON.stringify(replacements[i].value).length;
  }
  if (beforeSize < TEMPLATE_MIN_INPUT_BYTES) {
    return null;
  }
  const metadataSize = JSON.stringify([{ id: templateId, shape }]).length;
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
  const candidatePaths: (string | number)[][] = [];
  collectTemplateCandidatePaths(value, [], candidatePaths, { visitedNodes: 0 });
  if (candidatePaths.length === 0) {
    return { value, templates: [] };
  }

  let nextTemplateId = 0;
  const templates: FlightTemplateRowShape[] = [];
  for (let i = 0; i < candidatePaths.length; i += 1) {
    const candidatePath = candidatePaths[i];
    const node = getValueAtPath(value, candidatePath);
    if (!Array.isArray(node)) {
      continue;
    }
    const groups = new Map<string, number[]>();
    for (let j = 0; j < node.length; j += 1) {
      const signature = buildStructureSignature(node[j]);
      const group = groups.get(signature);
      if (group == null) {
        groups.set(signature, [j]);
      } else {
        group.push(j);
      }
    }

    const groupEntries = Array.from(groups.values()).sort((a, b) => b.length - a.length);
    const working = node.slice();
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
        working[index] = replacementValue;
      }
      templates.push(compacted.template);
      nextTemplateId += 1;
      mutated = true;
    }

    if (!mutated) {
      continue;
    }
    if (!setValueAtPath(value, candidatePath, working)) {
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

export function createEncodeContext(
  sink: RenderSink,
  queueDeferred: (task: Promise<void>) => void,
): EncodeContext {
  let nextRowId = 1;
  const outlinedByValue = new Map<string, number>();
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
      const compacted = compactRowValueTemplates(value);
      const paths = currentRevivePathsRef.current;
      if ((paths.length > 0 || compacted.templates.length > 0) && sink.emitMetadataRow) {
        sink.emitMetadataRow(id, pathsToTree(paths), compacted.templates);
      }
      sink.emitModelRow(id, compacted.value);
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
      const key = JSON.stringify(value);
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
        currentRevivePathsRef.current.push([...path]);
      },
    },
    preparePathsForEncode: () => {
      currentRevivePathsRef.current = [];
    },
  };
  return context;
}

export { encodeServerNode };
