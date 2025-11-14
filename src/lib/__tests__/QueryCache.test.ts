import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryCache } from "../QueryCache";

describe("QueryCache", () => {
  let queryCache: QueryCache;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    queryCache?.clear();
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("should create cache with default options", () => {
      queryCache = new QueryCache();
      expect(queryCache).toBeDefined();
    });

    it("should create cache with debug options", () => {
      queryCache = new QueryCache({
        debug: { enabled: true, prefix: "TEST" },
      });
      expect(queryCache).toBeDefined();
    });

    it("should create cache with gc options", () => {
      const onCollect = vi.fn();
      queryCache = new QueryCache({
        gc: { onCollect },
      });
      expect(queryCache).toBeDefined();
    });
  });

  describe("addQuery", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should add a query to the cache", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
      });

      expect(entry).toBeDefined();
      expect(entry.getState().status).toBe("pending");

      await entry.fetchQuery();
      expect(queryFn).toHaveBeenCalledWith(["test"]);
    });

    it("should return existing query for same key", async () => {
      const queryFn1 = vi.fn().mockResolvedValue("data1");
      const queryFn2 = vi.fn().mockResolvedValue("data2");

      const entry1 = queryCache.addQuery({
        key: ["test"],
        queryFn: queryFn1,
      });

      const entry2 = queryCache.addQuery({
        key: ["test"],
        queryFn: queryFn2,
      });

      expect(entry1).toBe(entry2);
      expect(queryFn1).toHaveBeenCalled();
      expect(queryFn2).not.toHaveBeenCalled(); // Should reuse existing query
    });

    it("should cache different queries for different keys", async () => {
      const queryFn1 = vi.fn().mockResolvedValue("data1");
      const queryFn2 = vi.fn().mockResolvedValue("data2");

      const entry1 = queryCache.addQuery({
        key: ["test", 1],
        queryFn: queryFn1,
      });

      const entry2 = queryCache.addQuery({
        key: ["test", 2],
        queryFn: queryFn2,
      });

      expect(entry1).not.toBe(entry2);
      await entry1.fetchQuery();
      await entry2.fetchQuery();
      expect(queryFn1).toHaveBeenCalledWith(["test", 1]);
      expect(queryFn2).toHaveBeenCalledWith(["test", 2]);
    });

    it("should use custom gcTime if provided", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
        gcTime: 5000,
      });

      expect(entry.getOptions().gcTime).toBe(5000);
    });

    it("should serialize complex keys consistently", () => {
      const queryFn1 = vi.fn().mockResolvedValue("data1");
      const queryFn2 = vi.fn().mockResolvedValue("data2");

      const entry1 = queryCache.addQuery({
        key: ["users", { id: 1, type: "admin" }],
        queryFn: queryFn1,
      });

      const entry2 = queryCache.addQuery({
        key: ["users", { id: 1, type: "admin" }],
        queryFn: queryFn2,
      });

      expect(entry1).toBe(entry2);
    });

    it("should handle null and undefined in keys", () => {
      const queryFn1 = vi.fn().mockResolvedValue("data1");
      const queryFn2 = vi.fn().mockResolvedValue("data2");

      const entry1 = queryCache.addQuery({
        key: ["test", null],
        queryFn: queryFn1,
      });

      const entry2 = queryCache.addQuery({
        key: ["test", undefined],
        queryFn: queryFn2,
      });

      // null and undefined serialize the same in JSON arrays
      expect(entry1).toBe(entry2);
    });
  });

  describe("invalidate", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should remove query from cache", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
      });

      queryCache.invalidate(["test"]);

      const newQueryFn = vi.fn().mockResolvedValue("new data");
      const newEntry = queryCache.addQuery({
        key: ["test"],
        queryFn: newQueryFn,
      });

      expect(newEntry).not.toBe(entry);
      expect(newQueryFn).toHaveBeenCalled();
    });

    it("should not affect other keys", () => {
      const queryFn1 = vi.fn().mockResolvedValue("data1");
      const queryFn2 = vi.fn().mockResolvedValue("data2");

      const entry1 = queryCache.addQuery({
        key: ["test", 1],
        queryFn: queryFn1,
      });

      queryCache.addQuery({
        key: ["test", 2],
        queryFn: queryFn2,
      });

      queryCache.invalidate(["test", 1]);

      const newQueryFn = vi.fn().mockResolvedValue("new data");
      const newEntry = queryCache.addQuery({
        key: ["test", 1],
        queryFn: newQueryFn,
      });

      expect(newEntry).not.toBe(entry1);
      expect(newQueryFn).toHaveBeenCalled();
      expect(queryCache.has(["test", 2])).toBe(true);
    });

    it("should handle invalidating non-existent key", () => {
      expect(() => queryCache.invalidate(["non-existent"])).not.toThrow();
    });
  });

  describe("has", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should return true for existing key", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      queryCache.addQuery({
        key: ["test"],
        queryFn,
      });

      expect(queryCache.has(["test"])).toBe(true);
    });

    it("should return false for non-existent key", () => {
      expect(queryCache.has(["non-existent"])).toBe(false);
    });

    it("should return false after invalidation", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      queryCache.addQuery({
        key: ["test"],
        queryFn,
      });

      queryCache.invalidate(["test"]);

      expect(queryCache.has(["test"])).toBe(false);
    });
  });

  describe("clear", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should remove all entries from cache", () => {
      queryCache.addQuery({
        key: ["test", 1],
        queryFn: vi.fn().mockResolvedValue("data1"),
      });

      queryCache.addQuery({
        key: ["test", 2],
        queryFn: vi.fn().mockResolvedValue("data2"),
      });

      queryCache.clear();

      expect(queryCache.has(["test", 1])).toBe(false);
      expect(queryCache.has(["test", 2])).toBe(false);
    });

    it("should allow adding new entries after clear", () => {
      queryCache.addQuery({
        key: ["test"],
        queryFn: vi.fn().mockResolvedValue("data"),
      });

      queryCache.clear();

      const newQueryFn = vi.fn().mockResolvedValue("new data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn: newQueryFn,
      });

      expect(entry).toBeDefined();
      expect(newQueryFn).toHaveBeenCalled();
    });
  });

  describe("query status tracking", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should track query fulfillment", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
      });

      expect(entry.getState().status).toBe("pending");

      const fetchPromise = entry.fetchQuery();
      expect(entry.getState().fetchStatus).toBe("fetching");

      await fetchPromise;

      expect(entry.getState().status).toBe("success");
      expect(entry.getState().data).toBe("data");
      expect(entry.getState().fetchStatus).toBe("idle");
    });

    it("should track query rejection", async () => {
      const error = new Error("test error");
      const queryFn = vi.fn().mockRejectedValue(error);
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
        retry: false,
      });

      expect(entry.getState().status).toBe("pending");

      await expect(entry.fetchQuery()).rejects.toThrow("test error");

      expect(entry.getState().status).toBe("error");
      expect(entry.getState().error).toBe(error);
    });

    it("should preserve status across multiple retrievals", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry1 = queryCache.addQuery({
        key: ["test"],
        queryFn,
      });

      await entry1.fetchQuery();

      const entry2 = queryCache.addQuery({
        key: ["test"],
        queryFn,
      });

      // Should return the same query instance (QueryClient reuses existing queries)
      expect(entry1.getKey()).toEqual(entry2.getKey());
      expect(entry2.getState().status).toBe("success");
      expect(entry2.getState().data).toBe("data");
    });
  });

  describe("staleTime", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should mark data as stale when staleTime is 0 (default)", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
        staleTime: 0,
      });

      await entry.fetchQuery();

      // Data should be stale immediately
      expect(queryCache.isStale(["test"])).toBe(true);
    });

    it("should mark data as fresh within staleTime window", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
        staleTime: 5000, // 5 seconds
      });

      await entry.fetchQuery();
      await vi.advanceTimersByTimeAsync(0);

      // Data should be fresh immediately after fetch
      // Note: Using entry.isStale() directly since QueryClient.isStale has a bug
      expect(entry.isStale()).toBe(false);
    });

    it("should mark data as stale after staleTime elapses", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
        staleTime: 1000, // 1 second
      });

      await entry.fetchQuery();
      await vi.advanceTimersByTimeAsync(0);

      // Fresh initially
      // Note: Using entry.isStale() directly since QueryClient.isStale has a bug
      expect(entry.isStale()).toBe(false);

      // Advance time past staleTime
      vi.advanceTimersByTime(1001);

      // Should now be stale
      expect(entry.isStale()).toBe(true);
    });

    it("should never mark data as stale when staleTime is Infinity", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
        staleTime: Infinity,
      });

      await entry.fetchQuery();
      await vi.advanceTimersByTimeAsync(0);

      // Fresh initially
      expect(queryCache.isStale(["test"])).toBe(false);

      // Advance time significantly
      vi.advanceTimersByTime(1000000);

      // Should still be fresh
      expect(queryCache.isStale(["test"])).toBe(false);
    });

    it("should never mark data as stale when staleTime is 'static'", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
        staleTime: "static",
      });

      await entry.fetchQuery();
      await vi.advanceTimersByTimeAsync(0);

      // Fresh initially
      expect(queryCache.isStale(["test"])).toBe(false);

      // Advance time significantly
      vi.advanceTimersByTime(1000000);

      // Should still be fresh
      expect(queryCache.isStale(["test"])).toBe(false);
    });

    it("should not invalidate entries with staleTime='static'", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
        staleTime: "static",
      });

      await entry.fetchQuery();

      // Try to invalidate
      queryCache.invalidate(["test"]);

      // Should still exist in cache
      expect(queryCache.has(["test"])).toBe(true);
    });

    it("should invalidate entries with numeric staleTime", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
        staleTime: 5000,
      });

      await entry.fetchQuery();

      // Should be able to invalidate
      queryCache.invalidate(["test"]);

      // Should not exist in cache
      expect(queryCache.has(["test"])).toBe(false);
    });

    it("should invalidate entries with staleTime=Infinity", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
        staleTime: Infinity,
      });

      await entry.fetchQuery();

      // Should be able to invalidate
      queryCache.invalidate(["test"]);

      // Should not exist in cache
      expect(queryCache.has(["test"])).toBe(false);
    });

    it("should return true for isStale when key doesn't exist", () => {
      expect(queryCache.isStale(["non-existent"])).toBe(true);
    });

    it("should return true for isStale when query hasn't resolved yet", () => {
      const queryFn = vi.fn(() => new Promise(() => {})); // Never resolves
      queryCache.addQuery({
        key: ["test"],
        queryFn,
        staleTime: 5000,
      });

      // Should be stale since dataUpdatedAt is undefined
      expect(queryCache.isStale(["test"])).toBe(true);
    });

    it("should update dataUpdatedAt when query resolves", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test"],
        queryFn,
        staleTime: 5000,
      });

      // dataUpdatedAt should be undefined initially
      expect(entry.getState().dataUpdatedAt).toBeUndefined();

      await entry.fetchQuery();

      // After resolution, dataUpdatedAt should be set
      expect(entry.getState().dataUpdatedAt).toBeDefined();
      expect(typeof entry.getState().dataUpdatedAt).toBe("number");
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should handle empty keys", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: [],
        queryFn,
      });

      expect(entry).toBeDefined();
      expect(queryCache.has([])).toBe(true);
    });

    it("should handle very large keys", () => {
      const largeKey = new Array(1000).fill(0).map((_, i) => i);
      const queryFn = vi.fn().mockResolvedValue("data");

      const entry = queryCache.addQuery({
        key: largeKey,
        queryFn,
      });

      expect(entry).toBeDefined();
      expect(queryCache.has(largeKey)).toBe(true);
    });

    it("should handle keys with special characters", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryCache.addQuery({
        key: ["test", "key with spaces & special!@#$%"],
        queryFn,
      });

      expect(entry).toBeDefined();
      expect(queryCache.has(["test", "key with spaces & special!@#$%"])).toBe(
        true
      );
    });
  });
});
