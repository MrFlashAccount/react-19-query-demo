# Revival Path Metadata – Optimization Plan

## Problem

The client currently **fully traverses** the decoded tree to revive client/server references into real functions. Both formats do this:

1. **Stream format** (RSC payload): `reviveModelValueTree` / `createModelReviver` recurses into every value—strings via `parseModelString`, arrays via `maybeDecodeElementTuple`, objects via key iteration.
2. **Wire format** (action replies): `decodeWireValueInternal` recurses into every object/array, checking `$t` tags.

The server **already knows** which fields need revival during serialization (`encodeStreamValueInternal`, `encodeWireValueImpl`). It emits `$C`, `$F`, `$L`, etc. (stream) or `{ $t: "clientRef" }`, etc. (wire) at specific locations.

## Proposed Solution: Path Metadata

Emit metadata with **paths** to values that need revival. The client then does **pruned traversal**—only recursing into branches that lead to a revivable value.

---

## 1. Path Representation

**Format:** Array of path segments. Paths are **relative to the row root** (each row is a separate value).

```
["props", "children", 0, "props", "onClick"]   // object key → array index → object key
```

**Revival kinds** (optional, for future optimization):
- `clientRef` – resolve via `resolveClientReference`
- `serverRef` – create via `createServerReference`
- `lazyChunk` – wrap via `createLazyChunkWrapper`
- `outlined` – Map/Set/FormData from chunk
- `element` – React element tuple `["$", type, key, props]`

For v1, paths alone suffice; the client can infer kind from the value at that path (e.g. string starting with `$C` vs `$F`).

---

## 2. Server-Side Changes

### 2.1 Stream encoding (`encodeStreamValueInternal`)

Add optional `collectRevivePaths?: (path: (string | number)[], kind: ReviveKind) => void` to `StreamEncodeContext`.

When encoding a value that needs revival:
- `$C` (clientRef) → `collectRevivePaths(currentPath, "clientRef")`
- `$F` (serverRef) → `collectRevivePaths(currentPath, "serverRef")`
- `$L` / `$`+hex (lazy chunk) → `collectRevivePaths(currentPath, "lazyChunk")`
- `$Q`, `$W`, `$K` (outlined Map/Set/FormData) → `collectRevivePaths(currentPath, "outlined")`
- `$n`, `$D`, `$P`, `$S`, `$u`, etc. → `collectRevivePaths(currentPath, "primitive")`
- Element tuple `["$", type, key, props]` → element itself doesn’t need revival, but `type` and `props` do; paths are inside the tuple (e.g. `[1]` for type, `[3]` for props, then recursive)

Thread `currentPath` through the encoder. On each recursive call, append the key/index.

### 2.2 Wire encoding (`encodeWireValueImpl`)

Same idea: optional `collectRevivePaths` in encode context. When emitting `{ $t: "clientRef" }`, `{ $t: "serverRef" }`, `{ $t: "rowRef" }`, etc., record the path.

### 2.3 Row format

**Option A – Per-row metadata row**

Emit a metadata row before/after each model row:

```
M0:{"revivePaths":[["props","onClick"],["props","children",1,"type"]]}
0:{"$":"div",null,{"onClick":"$F1a","children":[null,["$","$C./Client",null,{}]]}}
```

- `M` prefix = metadata for the following row.
- Client parses `M0`, stores paths for row `0`, then parses row `0` and uses pruned revival.

**Option B – Inline in row**

Extend model row to include metadata:

```
0:{"_revivePaths":[["props","onClick"],["props","children",1,"type"]],"$":"div",...}
```

- Requires the root to be an object. For element tuples `["$", type, key, props]`, the root is an array—paths would be `[1]`, `[3]`, etc. Works.

**Option C – Separate metadata block at end**

Emit all path metadata in a final block. More complex to correlate with rows; Option A or B is simpler.

**Recommendation:** Option A (metadata row) keeps the model row format unchanged and avoids polluting the payload with `_revivePaths`.

---

## 3. Client-Side Changes

### 3.1 Pruned traversal

Replace full-tree `reviveModelValueTreeInternal` with a path-aware version:

```ts
function reviveModelValueTreeWithPaths<Chunk>(
  context: StreamDecodeContext<Chunk>,
  parsedValue: unknown,
  revivePaths: ReadonlySet<string>, // path serialized as "props.children.0.props.onClick"
): unknown {
  if (revivePaths.size === 0) {
    return reviveModelValueTree(context, parsedValue); // fallback: full traversal
  }
  return reviveModelValueTreePruned(context, parsedValue, revivePaths, []);
}
```

Path set: use a serialized form like `"props.children.0.props.onClick"` for fast `has(prefix)` checks.

**Pruned recursion logic:**
- At each node, current path = `pathPrefix`.
- If no path in `revivePaths` has `pathPrefix` as prefix, **return value as-is** (no recursion). This is the prune.
- If current path is in `revivePaths`, apply revival (parseModelString / maybeDecodeElementTuple).
- Otherwise, recurse only into children that could match a path.

### 3.2 Path prefix matching

To prune, we need "is there any path starting with X?":

```ts
function hasPathWithPrefix(pathSet: Set<string>, prefix: string): boolean {
  if (pathSet.has(prefix)) return true;
  const prefixWithDot = prefix + ".";
  for (const p of pathSet) {
    if (p === prefix || p.startsWith(prefixWithDot)) return true;
  }
  return false;
}
```

For large path sets, use a trie or sorted array + binary search. For typical payloads (tens of paths), linear scan is fine.

### 3.3 Wire format

Same approach: `decodeWireValueInternal` gets optional `revivePaths`. When present, only recurse into branches that have a path prefix. Tagged values `{ $t: "clientRef" }` are leaves—no recursion; just resolve.

---

## 4. Backward Compatibility

- **No metadata** → client falls back to full traversal (current behavior).
- **Empty revivePaths** → same.
- Feature flag or version byte in stream to opt-in.

---

## 5. Implementation Phases

### Phase 1: Stream format, server
- Add `collectRevivePaths` to `StreamEncodeContext`.
- Thread path through `encodeStreamValueInternal` and `encodeServerNode`.
- Emit metadata row `M{id}:{paths}` before each model row when collector is present.

### Phase 2: Stream format, client
- Parse metadata rows, build `Map<rowId, revivePaths>`.
- Implement `reviveModelValueTreePruned`.
- Use pruned revival when paths exist for a row.

### Phase 3: Wire format
- Add path collection to `encodeWireValueImpl`.
- Implement pruned `decodeWireValueInternal`.
- Wire format is used for action replies; ensure metadata is passed through.

### Phase 4: Optimize path storage
- Consider path compression (shared prefixes, dictionary).
- Measure metadata size vs. tree size.

---

## 6. Edge Cases

- **Circular references:** Not supported by current runtime; no change.
- **Outlined values:** Path points to the placeholder string (e.g. `$F1a`). Revival fetches chunk; path is per-row, so row boundaries are correct.
- **Element tuples:** Paths into `["$", type, key, props]` use indices `1` (type) and `3` (props). Props is an object—paths continue as `3.props.onClick`.
- **Arrays with many primitives:** Pruning avoids recursing into array elements that don’t lead to a path. Big win for long lists.

---

## 7. Expected Impact

- **Deep trees with few refs:** Large reduction in nodes visited (e.g. 1000 nodes, 5 refs → ~50 visits).
- **Shallow trees:** Overhead of path metadata may outweigh benefit; optional/conditional emission.
- **Heavy use of refs:** Less benefit; still fewer visits than full traversal if refs are clustered.

---

## 8. Verification

- Unit tests: encode with path collection, decode with pruned revival, assert same result as full traversal.
- Perf tests: compare `reviveModelValueTree` vs `reviveModelValueTreePruned` on synthetic payloads with varying tree depth and ref count.
- Existing flight-runtime tests must pass with and without metadata.
