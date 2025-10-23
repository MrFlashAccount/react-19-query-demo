import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryCache } from "../QueryCache";

describe("QueryCache", () => {
  let queryCache: QueryCache;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    queryCache?.destroy();
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
      queryCache = new QueryCache({
        gc: { checkInterval: 200 },
      });
      expect(queryCache).toBeDefined();
    });
  });

  describe("addPromise", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should add a promise to the cache", () => {
      const promise = Promise.resolve("data");
      const entry = queryCache.addPromise({
        key: ["test"],
        promise,
      });

      expect(entry).toBeDefined();
      expect(entry()).toBe(promise);
      expect(entry.status).toBe("pending");
    });

    it("should return existing promise for same key", () => {
      const promise1 = Promise.resolve("data1");
      const promise2 = Promise.resolve("data2");

      const entry1 = queryCache.addPromise({
        key: ["test"],
        promise: promise1,
      });

      const entry2 = queryCache.addPromise({
        key: ["test"],
        promise: promise2,
      });

      expect(entry1).toBe(entry2);
      expect(entry1()).toBe(promise1);
      expect(entry2()).toBe(promise1);
    });

    it("should cache different promises for different keys", () => {
      const promise1 = Promise.resolve("data1");
      const promise2 = Promise.resolve("data2");

      const entry1 = queryCache.addPromise({
        key: ["test", 1],
        promise: promise1,
      });

      const entry2 = queryCache.addPromise({
        key: ["test", 2],
        promise: promise2,
      });

      expect(entry1()).toBe(promise1);
      expect(entry2()).toBe(promise2);
      expect(entry1).not.toBe(entry2);
    });

    it("should use custom gcTime if provided", () => {
      const promise = Promise.resolve("data");
      const entry = queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 5000,
      });

      expect(entry.gcTime).toBe(5000);
    });

    it("should serialize complex keys consistently", () => {
      const promise1 = Promise.resolve("data1");
      const promise2 = Promise.resolve("data2");

      const entry1 = queryCache.addPromise({
        key: ["users", { id: 1, type: "admin" }],
        promise: promise1,
      });

      const entry2 = queryCache.addPromise({
        key: ["users", { id: 1, type: "admin" }],
        promise: promise2,
      });

      expect(entry1).toBe(entry2);
    });

    it("should handle null and undefined in keys", () => {
      const promise1 = Promise.resolve("data1");
      const promise2 = Promise.resolve("data2");

      const entry1 = queryCache.addPromise({
        key: ["test", null],
        promise: promise1,
      });

      const entry2 = queryCache.addPromise({
        key: ["test", undefined],
        promise: promise2,
      });

      // null and undefined serialize the same in JSON arrays
      expect(entry1).toBe(entry2);
      expect(entry1()).toBe(promise1); // Should return first promise
    });
  });

  describe("invalidate", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should remove promise from cache", () => {
      const promise = Promise.resolve("data");
      const entry = queryCache.addPromise({
        key: ["test"],
        promise,
      });

      queryCache.invalidate(["test"]);

      const newPromise = Promise.resolve("new data");
      const newEntry = queryCache.addPromise({
        key: ["test"],
        promise: newPromise,
      });

      expect(newEntry).not.toBe(entry);
      expect(newEntry()).toBe(newPromise);
    });

    it("should not affect other keys", () => {
      const promise1 = Promise.resolve("data1");
      const promise2 = Promise.resolve("data2");

      const entry1 = queryCache.addPromise({
        key: ["test", 1],
        promise: promise1,
      });

      queryCache.addPromise({
        key: ["test", 2],
        promise: promise2,
      });

      queryCache.invalidate(["test", 1]);

      const newPromise = Promise.resolve("new data");
      const newEntry = queryCache.addPromise({
        key: ["test", 1],
        promise: newPromise,
      });

      expect(newEntry).not.toBe(entry1);
      expect(newEntry()).toBe(newPromise);
    });

    it("should handle invalidating non-existent key", () => {
      expect(() => queryCache.invalidate(["non-existent"])).not.toThrow();
    });

    it("should clear gc eligibility when invalidating", () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 1000,
      });

      // Make entry eligible for GC
      queryCache.unsubscribe(["test"]);

      // Invalidate should remove it
      queryCache.invalidate(["test"]);

      // Adding new promise should work without GC interference
      const newPromise = Promise.resolve("new data");
      const newEntry = queryCache.addPromise({
        key: ["test"],
        promise: newPromise,
      });

      expect(newEntry()).toBe(newPromise);
    });
  });

  describe("subscribe and unsubscribe", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should add subscription to entry", () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
      });

      queryCache.subscribe(["test"]);

      // Entry should not be eligible for GC while subscribed
      const entry = queryCache.addPromise({
        key: ["test"],
        promise: Promise.resolve("other"),
      });

      expect(entry()).toBe(promise); // Should return cached promise
    });

    it("should remove subscription from entry", () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 1000,
      });

      queryCache.subscribe(["test"]);
      queryCache.unsubscribe(["test"]);

      // Entry should now be eligible for GC
      vi.advanceTimersByTime(1100);
      vi.advanceTimersByTime(1);

      const newPromise = Promise.resolve("new data");
      const newEntry = queryCache.addPromise({
        key: ["test"],
        promise: newPromise,
      });

      // Should get new promise after GC
      expect(newEntry()).toBe(newPromise);
    });

    it("should handle multiple subscriptions", () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 1000,
      });

      queryCache.subscribe(["test"]);
      queryCache.subscribe(["test"]);

      // Unsubscribe one
      queryCache.unsubscribe(["test"]);

      // Entry should still not be collected (subscriber2 is active)
      vi.advanceTimersByTime(1100);
      vi.advanceTimersByTime(1);

      const entry = queryCache.addPromise({
        key: ["test"],
        promise: Promise.resolve("other"),
      });

      expect(entry()).toBe(promise); // Should return cached promise
    });

    it("should make entry eligible for GC when all subscriptions removed", () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 1000,
      });

      queryCache.subscribe(["test"]);
      queryCache.subscribe(["test"]);

      queryCache.unsubscribe(["test"]);
      queryCache.unsubscribe(["test"]);

      // Entry should now be collected
      vi.advanceTimersByTime(1100);
      vi.advanceTimersByTime(1);

      const newPromise = Promise.resolve("new data");
      const newEntry = queryCache.addPromise({
        key: ["test"],
        promise: newPromise,
      });

      expect(newEntry()).toBe(newPromise);
    });

    it("should handle subscribing to non-existent key", () => {
      expect(() => queryCache.subscribe(["non-existent"])).not.toThrow();
    });

    it("should handle unsubscribing from non-existent key", () => {
      expect(() => queryCache.unsubscribe(["non-existent"])).not.toThrow();
    });

    it("should handle unsubscribing when count is already zero", () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
      });

      // Unsubscribe without subscribing first (count is 0)
      expect(() => queryCache.unsubscribe(["test"])).not.toThrow();
    });
  });

  describe("has", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should return true for existing key", () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
      });

      expect(queryCache.has(["test"])).toBe(true);
    });

    it("should return false for non-existent key", () => {
      expect(queryCache.has(["non-existent"])).toBe(false);
    });

    it("should return false after invalidation", () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
      });

      queryCache.invalidate(["test"]);

      expect(queryCache.has(["test"])).toBe(false);
    });

    it("should return false after garbage collection", () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 1000,
      });

      // Make eligible for GC
      queryCache.unsubscribe(["test"]);

      // Wait for GC
      vi.advanceTimersByTime(1100);
      vi.advanceTimersByTime(1);

      expect(queryCache.has(["test"])).toBe(false);
    });
  });

  describe("clear", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should remove all entries from cache", () => {
      queryCache.addPromise({
        key: ["test", 1],
        promise: Promise.resolve("data1"),
      });

      queryCache.addPromise({
        key: ["test", 2],
        promise: Promise.resolve("data2"),
      });

      queryCache.clear();

      expect(queryCache.has(["test", 1])).toBe(false);
      expect(queryCache.has(["test", 2])).toBe(false);
    });

    it("should allow adding new entries after clear", () => {
      queryCache.addPromise({
        key: ["test"],
        promise: Promise.resolve("data"),
      });

      queryCache.clear();

      const newPromise = Promise.resolve("new data");
      const entry = queryCache.addPromise({
        key: ["test"],
        promise: newPromise,
      });

      expect(entry()).toBe(newPromise);
    });
  });

  describe("destroy", () => {
    it("should stop garbage collector", () => {
      queryCache = new QueryCache();

      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 1000,
      });

      queryCache.destroy();

      // GC should not run after destroy
      vi.advanceTimersByTime(2000);

      // Should still have the entry (GC didn't run)
      expect(queryCache.has(["test"])).toBe(true);
    });
  });

  describe("triggerGarbageCollection", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should immediately collect eligible entries", () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 1000,
      });

      queryCache.unsubscribe(["test"]);

      // Advance time past gcTime
      vi.advanceTimersByTime(1100);

      // Trigger GC manually
      queryCache.triggerGarbageCollection();

      expect(queryCache.has(["test"])).toBe(false);
    });

    it("should work without waiting for scheduler", () => {
      const onCollect = vi.fn();
      queryCache.destroy();
      queryCache = new QueryCache({
        gc: { onCollect },
      });

      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 1000,
      });

      queryCache.unsubscribe(["test"]);
      vi.advanceTimersByTime(1100);

      queryCache.triggerGarbageCollection();

      expect(onCollect).toHaveBeenCalledOnce();
    });
  });

  describe("gc callbacks", () => {
    it("should call onCollect when entry is collected", () => {
      const onCollect = vi.fn();
      queryCache = new QueryCache({
        gc: { onCollect },
      });

      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test", 1],
        promise,
        gcTime: 1000,
      });

      queryCache.unsubscribe(["test", 1]);

      vi.advanceTimersByTime(1100);
      vi.advanceTimersByTime(1);

      expect(onCollect).toHaveBeenCalledOnce();
      expect(onCollect).toHaveBeenCalledWith(JSON.stringify(["test", 1]));
    });
  });

  describe("promise status tracking", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should track promise fulfillment", async () => {
      const promise = Promise.resolve("data");
      const entry = queryCache.addPromise({
        key: ["test"],
        promise,
      });

      expect(entry.status).toBe("pending");
      expect(entry.isPending).toBe(true);

      await promise;

      expect(entry.status).toBe("fulfilled");
      expect(entry.isPending).toBe(false);
      expect(entry.isFulfilled).toBe(true);
      expect(entry.data).toBe("data");
    });

    it("should track promise rejection", async () => {
      const error = new Error("test error");
      const promise = Promise.reject(error);
      const entry = queryCache.addPromise({
        key: ["test"],
        promise,
      });

      expect(entry.status).toBe("pending");
      expect(entry.isPending).toBe(true);

      try {
        await entry();
      } catch (e) {
        // Expected to throw
      }

      expect(entry.status).toBe("rejected");
      expect(entry.isPending).toBe(false);
      expect(entry.isRejected).toBe(true);
      expect(entry.error).toBe(error);
    });

    it("should preserve status across multiple retrievals", async () => {
      const promise = Promise.resolve("data");
      const entry1 = queryCache.addPromise({
        key: ["test"],
        promise,
      });

      await promise;

      const entry2 = queryCache.addPromise({
        key: ["test"],
        promise: Promise.resolve("other"),
      });

      expect(entry1).toBe(entry2);
      expect(entry2.status).toBe("fulfilled");
      expect(entry2.data).toBe("data");
    });
  });

  describe("staleTime", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should mark data as stale when staleTime is 0 (default)", async () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        staleTime: 0,
      });

      await promise;

      // Data should be stale immediately
      expect(queryCache.isStale(["test"])).toBe(true);
    });

    it("should mark data as fresh within staleTime window", async () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        staleTime: 5000, // 5 seconds
      });

      await promise;

      // Data should be fresh immediately after fetch
      expect(queryCache.isStale(["test"])).toBe(false);
    });

    it("should mark data as stale after staleTime elapses", async () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        staleTime: 1000, // 1 second
      });

      await promise;

      // Fresh initially
      expect(queryCache.isStale(["test"])).toBe(false);

      // Advance time past staleTime
      vi.advanceTimersByTime(1001);

      // Should now be stale
      expect(queryCache.isStale(["test"])).toBe(true);
    });

    it("should never mark data as stale when staleTime is Infinity", async () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        staleTime: Infinity,
      });

      await promise;

      // Fresh initially
      expect(queryCache.isStale(["test"])).toBe(false);

      // Advance time significantly
      vi.advanceTimersByTime(1000000);

      // Should still be fresh
      expect(queryCache.isStale(["test"])).toBe(false);
    });

    it("should never mark data as stale when staleTime is 'static'", async () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        staleTime: "static",
      });

      await promise;

      // Fresh initially
      expect(queryCache.isStale(["test"])).toBe(false);

      // Advance time significantly
      vi.advanceTimersByTime(1000000);

      // Should still be fresh
      expect(queryCache.isStale(["test"])).toBe(false);
    });

    it("should not invalidate entries with staleTime='static'", async () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        staleTime: "static",
      });

      await promise;

      // Try to invalidate
      queryCache.invalidate(["test"]);

      // Should still exist in cache
      expect(queryCache.has(["test"])).toBe(true);
    });

    it("should invalidate entries with numeric staleTime", async () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        staleTime: 5000,
      });

      await promise;

      // Should be able to invalidate
      queryCache.invalidate(["test"]);

      // Should not exist in cache
      expect(queryCache.has(["test"])).toBe(false);
    });

    it("should invalidate entries with staleTime=Infinity", async () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        staleTime: Infinity,
      });

      await promise;

      // Should be able to invalidate
      queryCache.invalidate(["test"]);

      // Should not exist in cache
      expect(queryCache.has(["test"])).toBe(false);
    });

    it("should return true for isStale when key doesn't exist", () => {
      expect(queryCache.isStale(["non-existent"])).toBe(true);
    });

    it("should return true for isStale when promise hasn't resolved yet", () => {
      const promise = new Promise(() => {}); // Never resolves
      queryCache.addPromise({
        key: ["test"],
        promise,
        staleTime: 5000,
      });

      // Should be stale since dataUpdatedAt is undefined
      expect(queryCache.isStale(["test"])).toBe(true);
    });

    it("should update dataUpdatedAt when promise resolves", async () => {
      const promise = Promise.resolve("data");
      queryCache.addPromise({
        key: ["test"],
        promise,
        staleTime: 5000,
      });

      // dataUpdatedAt should be undefined initially
      const cacheEntry = queryCache.getCache().get(JSON.stringify(["test"]));
      expect(cacheEntry?.dataUpdatedAt).toBeUndefined();

      await promise;

      // After resolution, dataUpdatedAt should be set
      expect(cacheEntry?.dataUpdatedAt).toBeDefined();
      expect(typeof cacheEntry?.dataUpdatedAt).toBe("number");
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      queryCache = new QueryCache();
    });

    it("should handle empty keys", () => {
      const promise = Promise.resolve("data");
      const entry = queryCache.addPromise({
        key: [],
        promise,
      });

      expect(entry()).toBe(promise);
      expect(queryCache.has([])).toBe(true);
    });

    it("should handle very large keys", () => {
      const largeKey = new Array(1000).fill(0).map((_, i) => i);
      const promise = Promise.resolve("data");

      const entry = queryCache.addPromise({
        key: largeKey,
        promise,
      });

      expect(entry()).toBe(promise);
      expect(queryCache.has(largeKey)).toBe(true);
    });

    it("should handle keys with special characters", () => {
      const promise = Promise.resolve("data");
      const entry = queryCache.addPromise({
        key: ["test", "key with spaces & special!@#$%"],
        promise,
      });

      expect(entry()).toBe(promise);
      expect(queryCache.has(["test", "key with spaces & special!@#$%"])).toBe(
        true
      );
    });

    it("should handle concurrent operations", () => {
      const promise1 = Promise.resolve("data1");
      const promise2 = Promise.resolve("data2");

      const entry1 = queryCache.addPromise({
        key: ["test"],
        promise: promise1,
      });

      queryCache.subscribe(["test"]);
      queryCache.invalidate(["test"]);

      const entry2 = queryCache.addPromise({
        key: ["test"],
        promise: promise2,
      });

      expect(entry2()).toBe(promise2);
      expect(entry2).not.toBe(entry1);
    });
  });
});
