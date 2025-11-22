import type { Query } from "./Query";

/**
 * Type for array-based query keys (backward compatibility)
 */
export type AnyKey = Array<unknown>;

/**
 * A node in the query key tree
 * Each node can contain:
 * - A query associated with this specific path
 * - Child nodes for longer keys
 */
interface TreeNode {
  /** The query stored at this exact key path (undefined if this is just an intermediate node) */
  query?: Query<AnyKey, unknown>;
  /** Child nodes indexed by the next key segment */
  children: Map<unknown, TreeNode>;
}

/**
 * Normalize a key segment for use as a Map key.
 * - Primitives (string, number, boolean, symbol) are returned as-is
 * - null and undefined are both normalized to null (matching JSON.stringify behavior)
 * - Objects are serialized to JSON strings for consistent comparison
 *
 * This allows keys like ["user", { active: true }] to work correctly,
 * since Map uses reference equality for objects.
 */
function normalizeSegment(segment: unknown): unknown {
  // Treat null and undefined the same (matches JSON.stringify behavior in arrays)
  if (segment === null || segment === undefined) {
    return null;
  }

  const type = typeof segment;
  if (
    type === "string" ||
    type === "number" ||
    type === "boolean" ||
    type === "symbol"
  ) {
    return segment;
  }

  // For objects and arrays, serialize to ensure consistent comparison
  return JSON.stringify(segment);
}

/**
 * Tree-based storage for query keys that eliminates serialization overhead.
 *
 * Instead of using JSON.stringify to create flat string keys, this stores queries
 * in a tree structure where each level represents a segment of the key array.
 *
 * Benefits:
 * - O(key.length) lookup instead of O(key.length + serialization)
 * - O(prefix.length) prefix invalidation instead of O(cache size × key.length)
 * - Structural sharing: ['movies'], ['movies', 'action'] share 'movies' node
 * - No serialization/deserialization overhead
 * - More memory efficient (no duplicate key strings)
 *
 * @example
 * ```typescript
 * const tree = new QueryKeyTree();
 *
 * // Store queries
 * tree.set(['movies'], query1);
 * tree.set(['movies', 'action'], query2);
 * tree.set(['movies', 'action', 'popular'], query3);
 *
 * // Efficient lookup - no serialization!
 * const query = tree.get(['movies', 'action']);
 *
 * // Efficient prefix matching - only traverses relevant branch
 * const queries = tree.findByPrefix(['movies']); // Returns all 3 queries
 * ```
 */
export class QueryKeyTree {
  private root: TreeNode;
  private size: number = 0;

  constructor() {
    this.root = {
      children: new Map(),
    };
  }

  /**
   * Get a query by its exact key
   * O(key.length) complexity
   */
  get<Key extends AnyKey>(key: Key): Query<Key, unknown> | undefined {
    let node = this.root;

    for (const segment of key) {
      const normalizedSegment = normalizeSegment(segment);
      const child = node.children.get(normalizedSegment);
      if (!child) {
        return undefined;
      }
      node = child;
    }

    return node.query as Query<Key, unknown> | undefined;
  }

  /**
   * Set a query at the given key
   * O(key.length) complexity
   */
  set<Key extends AnyKey>(key: Key, query: Query<Key, unknown>): void {
    let node = this.root;

    for (const segment of key) {
      const normalizedSegment = normalizeSegment(segment);
      let child = node.children.get(normalizedSegment);
      if (!child) {
        child = {
          children: new Map(),
        };
        node.children.set(normalizedSegment, child);
      }
      node = child;
    }

    // Only increment size if this is a new query
    if (!node.query) {
      this.size++;
    }

    node.query = query as Query<AnyKey, unknown>;
  }

  /**
   * Check if a query exists at the given key
   * O(key.length) complexity
   */
  has<Key extends AnyKey>(key: Key): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a query at the given key
   * O(key.length) complexity
   *
   * Note: This only removes the query, not the tree nodes.
   * Tree nodes are kept for structural sharing with other keys.
   */
  delete<Key extends AnyKey>(key: Key): boolean {
    let node = this.root;
    const path: Array<{ node: TreeNode; segment: unknown }> = [];

    for (const segment of key) {
      const normalizedSegment = normalizeSegment(segment);
      const child = node.children.get(normalizedSegment);
      if (!child) {
        return false;
      }
      path.push({ node, segment: normalizedSegment });
      node = child;
    }

    if (!node.query) {
      return false;
    }

    node.query = undefined;
    this.size--;

    // Optional: Clean up empty nodes from leaf to root
    // This is a simple cleanup that removes childless nodes
    for (let i = path.length - 1; i >= 0; i--) {
      const { node: parentNode, segment } = path[i];
      const child = parentNode.children.get(segment);

      if (child && child.children.size === 0 && !child.query) {
        parentNode.children.delete(segment);
      } else {
        // Stop cleanup if we encounter a node that has children or a query
        break;
      }
    }

    return true;
  }

  /**
   * Find all queries that match a key prefix
   * O(prefix.length + matching subtree size) complexity
   *
   * Much more efficient than iterating all keys and checking each one!
   *
   * @example
   * ```typescript
   * // Get all movie-related queries
   * tree.findByPrefix(['movies']);
   * // Only traverses the 'movies' subtree
   *
   * // Get all action movie queries
   * tree.findByPrefix(['movies', 'action']);
   * // Only traverses the 'movies' -> 'action' subtree
   * ```
   */
  findByPrefix<Key extends AnyKey>(prefix: Key): Array<Query<AnyKey, unknown>> {
    let node = this.root;

    // Navigate to the prefix node
    for (const segment of prefix) {
      const normalizedSegment = normalizeSegment(segment);
      const child = node.children.get(normalizedSegment);
      if (!child) {
        return [];
      }
      node = child;
    }

    // Collect all queries in this subtree
    const queries: Array<Query<AnyKey, unknown>> = [];
    this.collectQueries(node, queries);
    return queries;
  }

  /**
   * Recursively collect all queries from a node and its descendants
   */
  private collectQueries(
    node: TreeNode,
    queries: Array<Query<AnyKey, unknown>>
  ): void {
    if (node.query) {
      queries.push(node.query);
    }

    for (const child of node.children.values()) {
      this.collectQueries(child, queries);
    }
  }

  /**
   * Get all queries in the tree
   * O(tree size) complexity
   */
  values(): IterableIterator<Query<AnyKey, unknown>> {
    const queries: Array<Query<AnyKey, unknown>> = [];
    this.collectQueries(this.root, queries);
    return queries.values();
  }

  /**
   * Get all query keys in the tree
   * O(tree size × average key length) complexity
   */
  keys(): IterableIterator<AnyKey> {
    const keys: Array<AnyKey> = [];
    this.collectKeys(this.root, [], keys);
    return keys.values();
  }

  /**
   * Recursively collect all keys from a node and its descendants
   */
  private collectKeys(
    node: TreeNode,
    currentPath: Array<unknown>,
    keys: Array<AnyKey>
  ): void {
    if (node.query) {
      keys.push([...currentPath]);
    }

    for (const [segment, child] of node.children.entries()) {
      this.collectKeys(child, [...currentPath, segment], keys);
    }
  }

  /**
   * Get all [key, query] pairs in the tree
   * O(tree size × average key length) complexity
   */
  entries(): IterableIterator<[AnyKey, Query<AnyKey, unknown>]> {
    const entries: Array<[AnyKey, Query<AnyKey, unknown>]> = [];
    this.collectEntries(this.root, [], entries);
    return entries.values();
  }

  /**
   * Recursively collect all entries from a node and its descendants
   */
  private collectEntries(
    node: TreeNode,
    currentPath: Array<unknown>,
    entries: Array<[AnyKey, Query<AnyKey, unknown>]>
  ): void {
    if (node.query) {
      entries.push([[...currentPath], node.query]);
    }

    for (const [segment, child] of node.children.entries()) {
      this.collectEntries(child, [...currentPath, segment], entries);
    }
  }

  /**
   * Clear all queries from the tree
   */
  clear(): void {
    this.root = {
      children: new Map(),
    };
    this.size = 0;
  }

  /**
   * Get the number of queries in the tree
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Check if the tree is empty
   */
  isEmpty(): boolean {
    return this.size === 0;
  }
}
