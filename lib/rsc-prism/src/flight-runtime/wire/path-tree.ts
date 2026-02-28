/**
 * Revive path tree: compact representation of which paths in a model need revival.
 *
 * Instead of storing every path like [[0,0],[0,1],[0,2],...] for array elements,
 * we use REVIVE_PATH_WILDCARD to mean "all indices at this level" when they
 * share the same subtree. Compaction reduces metadata size for large lists.
 */

function setValueAtPath(
  root: unknown,
  path: (string | number)[],
  reviver: (raw: string) => unknown,
): void {
  if (path.length === 0) {
    return;
  }
  let current = root;
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
  const lastKey = String(path[path.length - 1]);
  const lastSegment = (current as Record<string, unknown>)[lastKey];
  (current as Record<string, unknown>)[lastKey] = reviver(lastSegment as string);
}

function applyFlatPathReplacements(
  root: unknown,
  paths: ReadonlyArray<(string | number)[]>,
  reviver: (raw: string) => unknown,
): void {
  for (const path of paths) {
    if (path.length === 0) continue;
    setValueAtPath(root, path, reviver);
  }
}

/** Walks the tree and revives only $X strings at leaf paths; skips the rest of the model. */
export function applyDirectPathReplacements(
  root: unknown,
  revivePaths: ReadonlyArray<(string | number)[]>,
  reviver: (raw: string) => unknown,
): void {
  if (revivePaths.length === 0) return;
  applyFlatPathReplacements(root, revivePaths, reviver);
}

/** Applies reviver at each path; used for wire format tagged value decode. */
export function applyPathReplacements(
  root: unknown,
  paths: ReadonlyArray<(string | number)[]>,
  reviver: (value: unknown) => unknown,
): void {
  for (const path of paths) {
    if (path.length === 0) continue;
    setValueAtPath(root, path, reviver);
  }
}
