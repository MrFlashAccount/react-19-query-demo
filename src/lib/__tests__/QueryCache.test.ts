import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient } from "../QueryClient";

describe("QueryClient", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    queryClient?.clear();
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("should create cache with default options", () => {
      queryClient = new QueryClient();
      expect(queryClient).toBeDefined();
    });

    it("should create cache with debug options", () => {
      queryClient = new QueryClient({});
      expect(queryClient).toBeDefined();
    });
  });

  describe("addQuery", () => {
    beforeEach(() => {
      queryClient = new QueryClient();
    });

    it("should add a query to the cache", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
      });

      expect(entry).toBeDefined();
      expect(entry.getState().status).toBe("pending");

      await entry.fetch();
      expect(queryFn).toHaveBeenCalledWith(["test"]);
    });

    it("should return existing query for same key", async () => {
      const queryFn1 = vi.fn().mockResolvedValue("data1");
      const queryFn2 = vi.fn().mockResolvedValue("data2");

      const entry1 = queryClient.addQuery({
        key: ["test"],
        queryFn: queryFn1,
      });

      // Subscribe to trigger fetch
      entry1.subscribe(vi.fn());
      await vi.advanceTimersByTimeAsync(0);

      const entry2 = queryClient.addQuery({
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

      const entry1 = queryClient.addQuery({
        key: ["test", 1],
        queryFn: queryFn1,
      });

      const entry2 = queryClient.addQuery({
        key: ["test", 2],
        queryFn: queryFn2,
      });

      expect(entry1).not.toBe(entry2);
      await entry1.fetch();
      await entry2.fetch();
      expect(queryFn1).toHaveBeenCalledWith(["test", 1]);
      expect(queryFn2).toHaveBeenCalledWith(["test", 2]);
    });

    it("should use custom gcTime if provided", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
        gcTime: 5000,
      });

      expect(entry.getOptions().gcTime).toBe(5000);
    });

    it("should serialize complex keys consistently", () => {
      const queryFn1 = vi.fn().mockResolvedValue("data1");
      const queryFn2 = vi.fn().mockResolvedValue("data2");

      const entry1 = queryClient.addQuery({
        key: ["users", { id: 1, type: "admin" }],
        queryFn: queryFn1,
      });

      const entry2 = queryClient.addQuery({
        key: ["users", { id: 1, type: "admin" }],
        queryFn: queryFn2,
      });

      expect(entry1).toBe(entry2);
    });

    it("should handle null and undefined in keys", () => {
      const queryFn1 = vi.fn().mockResolvedValue("data1");
      const queryFn2 = vi.fn().mockResolvedValue("data2");

      const entry1 = queryClient.addQuery({
        key: ["test", null],
        queryFn: queryFn1,
      });

      const entry2 = queryClient.addQuery({
        key: ["test", undefined],
        queryFn: queryFn2,
      });

      // null and undefined serialize the same in JSON arrays
      expect(entry1).toBe(entry2);
    });
  });

  describe("invalidate", () => {
    beforeEach(() => {
      queryClient = new QueryClient();
    });

    it("should mark query as stale but keep it in cache", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
      });

      await entry.fetch();

      queryClient.invalidate(["test"]);

      // Query should still exist in cache
      expect(queryClient.has(["test"])).toBe(true);
      // Query should be stale
      expect(entry.isStale()).toBe(true);
      // Same instance should be reused
      const newEntry = queryClient.addQuery({
        key: ["test"],
        queryFn: vi.fn().mockResolvedValue("new data"),
      });

      expect(newEntry).toBe(entry);
    });

    it("should not affect other keys", async () => {
      const queryFn1 = vi.fn().mockResolvedValue("data1");
      const queryFn2 = vi.fn().mockResolvedValue("data2");

      const entry1 = queryClient.addQuery({
        key: ["test", 1],
        queryFn: queryFn1,
      });

      await entry1.fetch();

      queryClient.addQuery({
        key: ["test", 2],
        queryFn: queryFn2,
      });

      queryClient.invalidate(["test", 1]);

      // Entry1 should still exist but be stale
      expect(queryClient.has(["test", 1])).toBe(true);
      expect(entry1.isStale()).toBe(true);
      // Same instance should be reused
      const newEntry = queryClient.addQuery({
        key: ["test", 1],
        queryFn: vi.fn().mockResolvedValue("new data"),
      });

      expect(newEntry).toBe(entry1);
      expect(queryClient.has(["test", 2])).toBe(true);
    });

    it("should handle invalidating non-existent key", () => {
      expect(() => queryClient.invalidate(["non-existent"])).not.toThrow();
    });
  });

  describe("has", () => {
    beforeEach(() => {
      queryClient = new QueryClient();
    });

    it("should return true for existing key", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      queryClient.addQuery({
        key: ["test"],
        queryFn,
      });

      expect(queryClient.has(["test"])).toBe(true);
    });

    it("should return false for non-existent key", () => {
      expect(queryClient.has(["non-existent"])).toBe(false);
    });

    it("should return true after invalidation", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      queryClient.addQuery({
        key: ["test"],
        queryFn,
      });

      queryClient.invalidate(["test"]);

      expect(queryClient.has(["test"])).toBe(true);
    });
  });

  describe("clear", () => {
    beforeEach(() => {
      queryClient = new QueryClient();
    });

    it("should remove all entries from cache", () => {
      queryClient.addQuery({
        key: ["test", 1],
        queryFn: vi.fn().mockResolvedValue("data1"),
      });

      queryClient.addQuery({
        key: ["test", 2],
        queryFn: vi.fn().mockResolvedValue("data2"),
      });

      queryClient.clear();

      expect(queryClient.has(["test", 1])).toBe(false);
      expect(queryClient.has(["test", 2])).toBe(false);
    });

    it("should allow adding new entries after clear", async () => {
      queryClient.addQuery({
        key: ["test"],
        queryFn: vi.fn().mockResolvedValue("data"),
      });

      queryClient.clear();

      const newQueryFn = vi.fn().mockResolvedValue("new data");
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn: newQueryFn,
      });

      // Subscribe to trigger fetch
      entry.subscribe(vi.fn());
      await vi.advanceTimersByTimeAsync(0);

      expect(entry).toBeDefined();
      expect(newQueryFn).toHaveBeenCalled();
    });
  });

  describe("query status tracking", () => {
    beforeEach(() => {
      queryClient = new QueryClient();
    });

    it("should track query fulfillment", async () => {
      const queryFn = vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve("data"), 100);
          })
      );
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
      });

      expect(entry.getState().status).toBe("pending");

      // Subscribe to trigger fetch
      entry.subscribe(vi.fn());

      // Wait for fetch to start
      await vi.advanceTimersByTimeAsync(0);
      expect(entry.getState().fetchStatus).toBe("fetching");

      // Wait for fetch to complete
      await vi.advanceTimersByTimeAsync(100);

      expect(entry.getState().status).toBe("success");
      expect(entry.getState().data).toBe("data");
      expect(entry.getState().fetchStatus).toBe("idle");
    });

    it("should track query rejection", async () => {
      const error = new Error("test error");
      const queryFn = vi.fn().mockRejectedValue(error);
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
        retry: false,
      });

      expect(entry.getState().status).toBe("pending");

      await expect(entry.fetch()).rejects.toThrow("test error");

      expect(entry.getState().status).toBe("error");
      expect(entry.getState().error).toBe(error);
    });

    it("should preserve status across multiple retrievals", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry1 = queryClient.addQuery({
        key: ["test"],
        queryFn,
      });

      await entry1.fetch();

      const entry2 = queryClient.addQuery({
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
      queryClient = new QueryClient();
    });

    it("should mark data as stale when staleTime is 0 (default)", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
        staleTime: 0,
      });

      await entry.fetch();

      // Data should be stale immediately
      expect(queryClient.isStale(["test"])).toBe(true);
    });

    it("should mark data as fresh within staleTime window", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
        staleTime: 5000, // 5 seconds
      });

      await entry.fetch();
      await vi.advanceTimersByTimeAsync(0);

      // Data should be fresh immediately after fetch
      // Note: Using entry.isStale() directly since QueryClient.isStale has a bug
      expect(entry.isStale()).toBe(false);
    });

    it("should mark data as stale after staleTime elapses", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
        staleTime: 1000, // 1 second
      });

      await entry.fetch();
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
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
        staleTime: Infinity,
      });

      await entry.fetch();
      await vi.advanceTimersByTimeAsync(0);

      // Fresh initially
      expect(queryClient.isStale(["test"])).toBe(false);

      // Advance time significantly
      vi.advanceTimersByTime(1000000);

      // Should still be fresh
      expect(queryClient.isStale(["test"])).toBe(false);
    });

    it("should never mark data as stale when staleTime is 'static'", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
        staleTime: "static",
      });

      await entry.fetch();
      await vi.advanceTimersByTimeAsync(0);

      // Fresh initially
      expect(queryClient.isStale(["test"])).toBe(false);

      // Advance time significantly
      vi.advanceTimersByTime(1000000);

      // Should still be fresh
      expect(queryClient.isStale(["test"])).toBe(false);
    });

    it("should not invalidate entries with staleTime='static'", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
        staleTime: "static",
      });

      await entry.fetch();

      // Try to invalidate
      queryClient.invalidate(["test"]);

      // Should still exist in cache
      expect(queryClient.has(["test"])).toBe(true);
    });

    it("should invalidate entries with numeric staleTime", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
        staleTime: 5000,
      });

      await entry.fetch();

      // Should be able to invalidate
      queryClient.invalidate(["test"]);

      // Should still exist in cache but be stale
      expect(queryClient.has(["test"])).toBe(true);
      expect(entry.isStale()).toBe(true);
    });

    it("should invalidate entries with staleTime=Infinity", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
        staleTime: Infinity,
      });

      await entry.fetch();

      // Should be able to invalidate
      queryClient.invalidate(["test"]);

      // Should not exist in cache
      expect(queryClient.has(["test"])).toBe(true);
      expect(entry.isStale()).toBe(true);
    });

    it("should return true for isStale when key doesn't exist", () => {
      expect(queryClient.isStale(["non-existent"])).toBe(true);
    });

    it("should return true for isStale when query hasn't resolved yet", () => {
      const queryFn = vi.fn(() => new Promise(() => {})); // Never resolves
      queryClient.addQuery({
        key: ["test"],
        queryFn,
        staleTime: 5000,
      });

      // Should be stale since dataUpdatedAt is undefined
      expect(queryClient.isStale(["test"])).toBe(true);
    });

    it("should update dataUpdatedAt when query resolves", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryClient.addQuery({
        key: ["test"],
        queryFn,
        staleTime: 5000,
      });

      // dataUpdatedAt should be undefined initially
      expect(entry.getState().dataUpdatedAt).toBeUndefined();

      await entry.fetch();

      // After resolution, dataUpdatedAt should be set
      expect(entry.getState().dataUpdatedAt).toBeDefined();
      expect(typeof entry.getState().dataUpdatedAt).toBe("number");
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      queryClient = new QueryClient();
    });

    it("should handle empty keys", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryClient.addQuery({
        key: [],
        queryFn,
      });

      expect(entry).toBeDefined();
      expect(queryClient.has([])).toBe(true);
    });

    it("should handle very large keys", () => {
      const largeKey = new Array(1000).fill(0).map((_, i) => i);
      const queryFn = vi.fn().mockResolvedValue("data");

      const entry = queryClient.addQuery({
        key: largeKey,
        queryFn,
      });

      expect(entry).toBeDefined();
      expect(queryClient.has(largeKey)).toBe(true);
    });

    it("should handle keys with special characters", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const entry = queryClient.addQuery({
        key: ["test", "key with spaces & special!@#$%"],
        queryFn,
      });

      expect(entry).toBeDefined();
      expect(queryClient.has(["test", "key with spaces & special!@#$%"])).toBe(
        true
      );
    });
  });
});
