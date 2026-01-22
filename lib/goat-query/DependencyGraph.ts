import { isMutation, type MutationDefinition } from "./nodes/mutation";
import { isQuery, type QueryDefinition } from "./nodes/query";

export const DYNAMIC_MARKER = -1;

/**
 * A node in the dependency graph (either a query or mutation definition)
 * Uses 'any' for type parameters to accept definitions with any params
 */
type GraphNode = QueryDefinition<any, any> | MutationDefinition<any, any>;

/**
 * Parsed invalidation relationship between a mutation and query
 */
interface ParsedInvalidation {
  mutationIndex: number;
  queryIndex: number;
  conditional: boolean;
}

/**
 * Parsed optimistic update relationship between a mutation and query
 */
interface ParsedOptimisticUpdate {
  mutationIndex: number;
  queryIndex: number;
  conditional: boolean;
}

/**
 * Manages the dependency graph between queries and mutations.
 * Parses relationships at construction time and provides efficient lookups at runtime.
 */
export class DependencyGraph {
  private nodesByIndex = new Map<number, GraphNode>();
  private queries = new Map<number, QueryDefinition<any, any>>();
  private mutations = new Map<number, MutationDefinition<any, any>>();

  private invalidations: ParsedInvalidation[] = [];
  private optimisticUpdates: ParsedOptimisticUpdate[] = [];

  /**
   * Creates a dependency graph from an array of query and mutation definitions.
   * Assigns indices to each node and parses relationships.
   *
   * @param nodes - Array of query and mutation definitions
   *
   * @example
   * ```typescript
   * const graph = new DependencyGraph([
   *   moviesQuery,
   *   movieDetailQuery,
   *   addMovieMutation,
   * ]);
   * ```
   */
  constructor(nodes: GraphNode[]) {
    this.buildGraph(nodes);
  }

  /**
   * Builds the graph by assigning indices and parsing relationships
   */
  private buildGraph(nodes: GraphNode[]): void {
    // First pass: assign indices to all nodes
    nodes.forEach((node, index) => {
      // Mutate the __index property to assign the graph index
      (node as { __index?: number }).__index = index;
      this.nodesByIndex.set(index, node);

      if (isQuery(node)) {
        this.queries.set(index, node);
      } else if (isMutation(node)) {
        this.mutations.set(index, node);
      } else {
        throw new Error(
          `Invalid node type in dependency graph at index ${index}. ` +
            `Expected query or mutation definition.`
        );
      }
    });

    // Second pass: parse mutation relationships
    for (const node of this.nodesByIndex.values()) {
      if (isMutation(node)) {
        this.parseMutationRelations(node);
      }
    }
  }

  /**
   * Parses invalidation and optimistic update relationships for a mutation
   */
  private parseMutationRelations(mutation: MutationDefinition): void {
    const { invalidates, optimistic } = mutation.config;

    if (mutation.__index === undefined) {
      throw new Error(
        "Mutation index not set. This is an internal error in graph construction."
      );
    }

    // Parse invalidation relationships
    if (invalidates) {
      if (Array.isArray(invalidates)) {
        // Static array of queries to invalidate
        for (const query of invalidates) {
          if (!isQuery(query)) {
            throw new Error(
              `Invalid query in invalidates array for mutation at index ${mutation.__index}. ` +
                `Expected a query definition.`
            );
          }
          if (query.__index === undefined) {
            throw new Error(
              `Query in invalidates array for mutation at index ${mutation.__index} ` +
                `has no index. Make sure the query is registered in the graph.`
            );
          }

          this.invalidations.push({
            mutationIndex: mutation.__index,
            queryIndex: query.__index,
            conditional: false,
          });
        }
      } else {
        // Function - mark as conditional (will be computed at runtime)
        this.invalidations.push({
          mutationIndex: mutation.__index,
          queryIndex: DYNAMIC_MARKER,
          conditional: true,
        });
      }
    }

    // Parse optimistic update relationships
    if (optimistic) {
      this.optimisticUpdates.push({
        mutationIndex: mutation.__index,
        queryIndex: DYNAMIC_MARKER,
        conditional: true,
      });
    }
  }
}
