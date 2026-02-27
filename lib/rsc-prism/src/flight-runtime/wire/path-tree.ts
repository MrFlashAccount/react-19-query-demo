/**
 * Revive path tree: compact representation of which paths in a model need revival.
 *
 * Instead of storing every path like [[0,0],[0,1],[0,2],...] for array elements,
 * we use REVIVE_PATH_WILDCARD to mean "all indices at this level" when they
 * share the same subtree. Compaction reduces metadata size for large lists.
 */
import { REVIVE_PATH_WILDCARD } from "./constants";
import { isFlightWireString } from "./shared";

/** Tree: [key, subtree][] where subtree is true (leaf) or nested [key, subtree][]. */
/** REVIVE_PATH_WILDCARD (-1) means "all array indexes at this level". */
export type RevivePathTree = [string | number, RevivePathTree | true][];

/** Merges consecutive numeric keys with identical subtrees into REVIVE_PATH_WILDCARD. */
function compactRevivePathTree(
  tree: RevivePathTree,
  cache: Map<RevivePathTree, RevivePathTree>,
): RevivePathTree {
  const cached = cache.get(tree);
  if (cached) return cached;

  for (let i = 0; i < tree.length; i += 1) {
    const child = tree[i][1];
    if (child !== true) {
      tree[i][1] = compactRevivePathTree(child, cache);
    }
  }

  const numericChildren: RevivePathTree = [];
  const otherChildren: RevivePathTree = [];
  for (const entry of tree) {
    const [key] = entry;
    if (typeof key === "number" && key >= 0) {
      numericChildren.push(entry);
      continue;
    }
    otherChildren.push(entry);
  }

  if (numericChildren.length < 2) {
    cache.set(tree, tree);
    return tree;
  }

  // mapToArray deduplicates subtrees, so identical structure => same ref; use === not JSON.stringify
  const firstSubtree = numericChildren[0][1];
  for (let i = 1; i < numericChildren.length; i += 1) {
    if (numericChildren[i][1] !== firstSubtree) {
      cache.set(tree, tree);
      return tree;
    }
  }

  otherChildren.push([REVIVE_PATH_WILDCARD, firstSubtree]);
  cache.set(tree, otherChildren);
  return otherChildren;
}

export type MutablePathTree = Map<string | number, MutablePathTree | true>;

/** Inserts a path into a mutable tree; use during encode to avoid building from flat list later. */
export function pushPathToTree(root: MutablePathTree, path: ReadonlyArray<string | number>): void {
  let current = root;
  for (let i = 0; i < path.length; i += 1) {
    const seg = path[i];
    const isLast = i === path.length - 1;
    if (isLast) {
      current.set(seg, true);
      return;
    }
    let next = current.get(seg);
    if (next === undefined || next === true) {
      next = new Map();
      current.set(seg, next);
    }
    current = next as MutablePathTree;
  }
}

function pathTreeToKey(t: RevivePathTree): string {
  if (t.length === 0) return "[]";
  const parts: string[] = [];
  for (const [k, v] of t) {
    parts.push(String(k) + ":" + (v === true ? true : pathTreeToKey(v)));
  }
  return "[" + parts.join(",") + "]";
}

function mapToArray(m: MutablePathTree, subtreeCache: Map<string, RevivePathTree>): RevivePathTree {
  const out: RevivePathTree = [];
  for (const [k, v] of m) {
    out.push([k, v === true ? true : mapToArray(v as MutablePathTree, subtreeCache)]);
  }
  const key = pathTreeToKey(out);
  const cached = subtreeCache.get(key);
  if (cached) return cached;
  subtreeCache.set(key, out);
  return out;
}

/** Converts mutable tree to compact RevivePathTree; call after encode when paths are done. */
export function finalizePathTree(root: MutablePathTree): RevivePathTree {
  const subtreeCache = new Map<string, RevivePathTree>();
  const compactCache = new Map<RevivePathTree, RevivePathTree>();
  return compactRevivePathTree(mapToArray(root, subtreeCache), compactCache);
}

/** Builds a compact tree from flat path list; deduplicates identical subtrees via cache. */
export function pathsToTree(paths: ReadonlyArray<(string | number)[]>): RevivePathTree {
  const root: MutablePathTree = new Map();
  for (const path of paths) {
    pushPathToTree(root, path);
  }
  return finalizePathTree(root);
}

function isRevivePathTree(value: unknown): value is RevivePathTree {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    Array.isArray(value[0]) &&
    value[0].length === 2 &&
    (value[0][1] === true || Array.isArray(value[0][1]))
  );
}

function getValueAtPath(root: unknown, path: (string | number)[]): unknown {
  let current: unknown = root;
  for (let i = 0; i < path.length; i += 1) {
    const segment = path[i];
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[String(segment)];
  }
  return current;
}

function setValueAtPath(root: unknown, path: (string | number)[], value: unknown): void {
  if (path.length === 0) {
    return;
  }
  let current: unknown = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const segment = path[i];
    if (current == null || typeof current !== "object") {
      return;
    }
    current = (current as Record<string, unknown>)[String(segment)];
  }
  if (current == null || typeof current !== "object") {
    return;
  }
  const last = path[path.length - 1];
  (current as Record<string, unknown>)[String(last)] = value;
}

function applyPathTreeReplacements(
  root: unknown,
  tree: RevivePathTree,
  path: (string | number)[],
  reviver: (raw: string) => unknown,
): void {
  for (const [key, child] of tree) {
    if (key === REVIVE_PATH_WILDCARD) {
      const target = path.length === 0 ? root : getValueAtPath(root, path);
      if (!Array.isArray(target)) {
        continue;
      }
      for (let i = 0; i < target.length; i += 1) {
        path.push(i);
        if (child === true) {
          const raw = target[i];
          if (typeof raw === "string" && isFlightWireString(raw)) {
            target[i] = reviver(raw);
          }
        } else {
          applyPathTreeReplacements(root, child, path, reviver);
        }
        path.pop();
      }
      continue;
    }

    path.push(key);
    if (child === true) {
      const raw = getValueAtPath(root, path);
      if (typeof raw === "string" && isFlightWireString(raw)) {
        setValueAtPath(root, path, reviver(raw));
      }
    } else {
      applyPathTreeReplacements(root, child, path, reviver);
    }
    path.pop();
  }
}

function applyFlatPathReplacements(
  root: unknown,
  paths: ReadonlyArray<(string | number)[]>,
  reviver: (raw: string) => unknown,
): void {
  for (const path of paths) {
    if (path.length === 0) continue;
    const raw = getValueAtPath(root, path);
    if (typeof raw === "string" && isFlightWireString(raw)) {
      setValueAtPath(root, path, reviver(raw));
    }
  }
}

/** Walks the tree and revives only $X strings at leaf paths; skips the rest of the model. */
export function applyDirectPathReplacements(
  root: unknown,
  revivePathsOrTree: RevivePathTree | ReadonlyArray<(string | number)[]>,
  reviver: (raw: string) => unknown,
): void {
  if (isRevivePathTree(revivePathsOrTree)) {
    if (revivePathsOrTree.length === 0) return;
    applyPathTreeReplacements(root, revivePathsOrTree, [], reviver);
  } else {
    if (revivePathsOrTree.length === 0) return;
    applyFlatPathReplacements(root, revivePathsOrTree, reviver);
  }
}

/** Applies reviver at each path; used for wire format tagged value decode. */
export function applyPathReplacements(
  root: unknown,
  paths: ReadonlyArray<(string | number)[]>,
  reviver: (value: unknown) => unknown,
): void {
  for (const path of paths) {
    if (path.length === 0) continue;
    const value = getValueAtPath(root, path);
    setValueAtPath(root, path, reviver(value));
  }
}
