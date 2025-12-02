import { describe, it, expect, beforeEach } from "vitest";
import { QueryCache } from "../QueryCache";
import { DependencyGraph, query } from "../DependencyGraph";

describe("QueryCache - Simplified Tests", () => {
  let cache: QueryCache;
  let graph: DependencyGraph;

  // Define test queries
  const moviesQuery = query({
    queryFn: async (params: { page: number }) => `movies-page-${params.page}`,
    staleTime: 5000,
  });

  const movieDetailQuery = query({
    queryFn: async (params: { id: number }) => `movie-${params.id}`,
    staleTime: 10000,
  });

  // Mock query factory
  const mockQuery = () => ({
    getState: () => ({ status: "success", data: "mock" }),
    invalidate: () => Promise.resolve("mock"),
  } as any);

  beforeEach(() => {
    graph = new DependencyGraph([moviesQuery, movieDetailQuery]);
    cache = new QueryCache();
  });

  it("should store and retrieve queries", () => {
    const q1 = mockQuery();
    cache.set(moviesQuery, { page: 1 }, q1);
    expect(cache.get(moviesQuery, { page: 1 })).toBe(q1);
  });

  it("should distinguish different params", () => {
    const q1 = mockQuery();
    const q2 = mockQuery();
    
    cache.set(moviesQuery, { page: 1 }, q1);
    cache.set(moviesQuery, { page: 2 }, q2);
    
    expect(cache.get(moviesQuery, { page: 1 })).toBe(q1);
    expect(cache.get(moviesQuery, { page: 2 })).toBe(q2);
  });

  it("should distinguish different definitions", () => {
    const q1 = mockQuery();
    const q2 = mockQuery();
    
    cache.set(moviesQuery, { page: 1 }, q1);
    cache.set(movieDetailQuery, { id: 5 }, q2);
    
    expect(cache.getDefinitionCount()).toBe(2);
  });

  it("should find all queries by definition", () => {
    const q1 = mockQuery();
    const q2 = mockQuery();
    const q3 = mockQuery();
    
    cache.set(moviesQuery, { page: 1 }, q1);
    cache.set(moviesQuery, { page: 2 }, q2);
    cache.set(movieDetailQuery, { id: 5 }, q3);
    
    const queries = cache.findByDefinition(moviesQuery);
    expect(queries).toHaveLength(2);
    expect(queries).toContain(q1);
    expect(queries).toContain(q2);
    expect(queries).not.toContain(q3);
  });

  it("should delete queries", () => {
    const q1 = mockQuery();
    cache.set(moviesQuery, { page: 1 }, q1);
    
    expect(cache.has(moviesQuery, { page: 1 })).toBe(true);
    cache.delete(moviesQuery, { page: 1 });
    expect(cache.has(moviesQuery, { page: 1 })).toBe(false);
  });

  it("should track size", () => {
    expect(cache.getSize()).toBe(0);
    
    cache.set(moviesQuery, { page: 1 }, mockQuery());
    expect(cache.getSize()).toBe(1);
    
    cache.set(moviesQuery, { page: 2 }, mockQuery());
    expect(cache.getSize()).toBe(2);
  });

  it("should provide statistics", () => {
    cache.set(moviesQuery, { page: 1 }, mockQuery());
    cache.set(moviesQuery, { page: 2 }, mockQuery());
    cache.set(movieDetailQuery, { id: 5 }, mockQuery());
    
    const stats = cache.getStats();
    expect(stats.totalQueries).toBe(3);
    expect(stats.uniqueDefinitions).toBe(2);
  });

  it("should clear cache", () => {
    cache.set(moviesQuery, { page: 1 }, mockQuery());
    cache.set(movieDetailQuery, { id: 5 }, mockQuery());
    
    cache.clear();
    expect(cache.isEmpty()).toBe(true);
    expect(cache.getSize()).toBe(0);
  });

  it("should work with unregistered definitions", () => {
    // Since we use definition references directly, registration is no longer required for caching
    const unregistered = query({ queryFn: async () => "data" });
    
    const q1 = mockQuery();
    cache.set(unregistered, undefined, q1);
    expect(cache.get(unregistered, undefined)).toBe(q1);
    expect(cache.getSize()).toBe(1);
  });

  it("should find queries by multiple definitions", () => {
    const q1 = mockQuery();
    const q2 = mockQuery();
    const q3 = mockQuery();
    
    cache.set(moviesQuery, { page: 1 }, q1);
    cache.set(moviesQuery, { page: 2 }, q2);
    cache.set(movieDetailQuery, { id: 5 }, q3);
    
    const queries = cache.findByDefinitions(new Set([moviesQuery, movieDetailQuery]));
    expect(queries).toHaveLength(3);
    expect(queries).toContain(q1);
    expect(queries).toContain(q2);
    expect(queries).toContain(q3);
  });
});

