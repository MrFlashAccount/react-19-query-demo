import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GarbageCollector,
  type CacheEntry,
  type GarbageCollectorOptions,
} from "../GarbageCollector";
import { PromiseEntryFactory } from "../PromiseEntry";

describe("GarbageCollector", () => {
  let cache: Map<string, CacheEntry>;
  let gc: GarbageCollector;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new Map();
  });

  afterEach(() => {
    gc?.stop();
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("should create collector with default options", () => {
      gc = new GarbageCollector();
      expect(gc).toBeDefined();
    });

    it("should accept custom check interval", () => {
      gc = new GarbageCollector({ checkInterval: 200 });
      expect(gc).toBeDefined();
    });

    it("should accept custom onCollect callback", () => {
      const onCollect = vi.fn();
      gc = new GarbageCollector({ onCollect });
      expect(gc).toBeDefined();
    });
  });

  describe("start and stop", () => {
    it("should start the scheduler", () => {
      gc = new GarbageCollector();
      gc.start(cache);

      // Scheduler should be running
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    });

    it("should stop the scheduler", () => {
      gc = new GarbageCollector();
      gc.start(cache);
      gc.stop();

      const timerCount = vi.getTimerCount();
      expect(timerCount).toBe(0);
    });

    it("should not start multiple schedulers", () => {
      gc = new GarbageCollector();
      gc.start(cache);
      const timerCount1 = vi.getTimerCount();

      gc.start(cache);
      const timerCount2 = vi.getTimerCount();

      expect(timerCount1).toBe(timerCount2);
    });

    it("should use custom check interval", () => {
      gc = new GarbageCollector({ checkInterval: 200 });
      gc.start(cache);

      // Should not run immediately
      expect(cache.size).toBe(0);

      // Should run after 200ms
      vi.advanceTimersByTime(200);

      // Timer should have executed (even if no collection happened)
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    });
  });

  describe("markEligible and clearEligibility", () => {
    beforeEach(() => {
      gc = new GarbageCollector();
      gc.start(cache);
    });

    it("should mark entry as eligible for garbage collection", () => {
      const key = JSON.stringify(["test"]);
      const promise = Promise.resolve("data");
      const entry: CacheEntry = {
        promise: PromiseEntryFactory.create(promise, { gcTime: 1000 }),
        subscriptions: 0,
        gcTime: 1000,
      };

      cache.set(key, entry);
      gc.markEligible(key);

      expect(entry.gcEligibleAt).toBeDefined();
      expect(entry.gcEligibleAt).toBe(Date.now());
    });

    it("should clear eligibility marker", () => {
      const key = JSON.stringify(["test"]);
      const promise = Promise.resolve("data");
      const entry: CacheEntry = {
        promise: PromiseEntryFactory.create(promise, { gcTime: 1000 }),
        subscriptions: 0,
        gcTime: 1000,
        gcEligibleAt: Date.now(),
      };

      cache.set(key, entry);
      gc.clearEligibility(key);

      expect(entry.gcEligibleAt).toBeUndefined();
    });

    it("should handle marking non-existent entry", () => {
      expect(() => gc.markEligible("non-existent")).not.toThrow();
    });

    it("should handle clearing non-existent entry", () => {
      expect(() => gc.clearEligibility("non-existent")).not.toThrow();
    });
  });

  describe("garbage collection", () => {
    beforeEach(() => {
      gc = new GarbageCollector({ checkInterval: 100 });
      gc.start(cache);
    });

    it("should not collect entries that are not eligible", () => {
      const key = JSON.stringify(["test"]);
      const promise = Promise.resolve("data");
      const entry: CacheEntry = {
        promise: PromiseEntryFactory.create(promise, { gcTime: 5000 }),
        subscriptions: 0,
        gcTime: 5000,
      };

      cache.set(key, entry);

      // Advance time and trigger GC
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(1);

      expect(cache.has(key)).toBe(true);
    });

    it("should not collect entries with active subscriptions", () => {
      const key = JSON.stringify(["test"]);
      const promise = Promise.resolve("data");
      const entry: CacheEntry = {
        promise: PromiseEntryFactory.create(promise, { gcTime: 1000 }),
        subscriptions: 1,
        gcTime: 1000,
        gcEligibleAt: Date.now(),
      };

      cache.set(key, entry);

      // Advance past gcTime
      vi.advanceTimersByTime(1100);
      vi.advanceTimersByTime(1);

      expect(cache.has(key)).toBe(true);
    });

    it("should collect eligible entries after gcTime has passed", () => {
      const key = JSON.stringify(["test"]);
      const promise = Promise.resolve("data");
      const entry: CacheEntry = {
        promise: PromiseEntryFactory.create(promise, { gcTime: 1000 }),
        subscriptions: 0,
        gcTime: 1000,
        gcEligibleAt: Date.now(),
      };

      cache.set(key, entry);

      // Advance past gcTime
      vi.advanceTimersByTime(1000);
      // Trigger scheduler
      vi.advanceTimersByTime(100);
      // Trigger idle callback
      vi.advanceTimersByTime(1);

      expect(cache.has(key)).toBe(false);
    });

    it("should not collect entries without gcTime", () => {
      const key = JSON.stringify(["test"]);
      const promise = Promise.resolve("data");
      const entry: CacheEntry = {
        promise: PromiseEntryFactory.create(promise), // No gcTime
        subscriptions: 0,
        gcEligibleAt: Date.now(),
      };

      cache.set(key, entry);

      // Advance time significantly
      vi.advanceTimersByTime(10000);
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(1);

      expect(cache.has(key)).toBe(true);
    });

    it("should call onCollect callback when collecting", () => {
      const onCollect = vi.fn();
      gc.stop();
      gc = new GarbageCollector({ checkInterval: 100, onCollect });
      gc.start(cache);

      const key = JSON.stringify(["test"]);
      const promise = Promise.resolve("data");
      const entry: CacheEntry = {
        promise: PromiseEntryFactory.create(promise, { gcTime: 1000 }),
        subscriptions: 0,
        gcTime: 1000,
        gcEligibleAt: Date.now(),
      };

      cache.set(key, entry);

      // Advance past gcTime and trigger GC
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(1);

      expect(onCollect).toHaveBeenCalledOnce();
      expect(onCollect).toHaveBeenCalledWith(key);
    });

    it("should collect multiple eligible entries", () => {
      const onCollect = vi.fn();
      gc.stop();
      gc = new GarbageCollector({ checkInterval: 100, onCollect });
      gc.start(cache);

      const key1 = JSON.stringify(["test", 1]);
      const key2 = JSON.stringify(["test", 2]);

      const promise1 = Promise.resolve("data1");
      const promise2 = Promise.resolve("data2");

      const entry1: CacheEntry = {
        promise: PromiseEntryFactory.create(promise1, { gcTime: 1000 }),
        subscriptions: 0,
        gcTime: 1000,
        gcEligibleAt: Date.now(),
      };

      const entry2: CacheEntry = {
        promise: PromiseEntryFactory.create(promise2, { gcTime: 1000 }),
        subscriptions: 0,
        gcTime: 1000,
        gcEligibleAt: Date.now(),
      };

      cache.set(key1, entry1);
      cache.set(key2, entry2);

      // Advance past gcTime and trigger GC
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(1);

      expect(cache.has(key1)).toBe(false);
      expect(cache.has(key2)).toBe(false);
      expect(onCollect).toHaveBeenCalledTimes(2);
    });

    it("should only collect entries that have passed their individual gcTime", () => {
      const key1 = JSON.stringify(["test", 1]);
      const key2 = JSON.stringify(["test", 2]);

      const promise1 = Promise.resolve("data1");
      const promise2 = Promise.resolve("data2");

      const entry1: CacheEntry = {
        promise: PromiseEntryFactory.create(promise1, { gcTime: 500 }),
        subscriptions: 0,
        gcTime: 500,
        gcEligibleAt: Date.now(),
      };

      const entry2: CacheEntry = {
        promise: PromiseEntryFactory.create(promise2, { gcTime: 2000 }),
        subscriptions: 0,
        gcTime: 2000,
        gcEligibleAt: Date.now(),
      };

      cache.set(key1, entry1);
      cache.set(key2, entry2);

      // Advance to 600ms (past entry1's gcTime, before entry2's)
      vi.advanceTimersByTime(600);
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(1);

      expect(cache.has(key1)).toBe(false);
      expect(cache.has(key2)).toBe(true);

      // Advance past entry2's gcTime
      vi.advanceTimersByTime(1400);
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(1);

      expect(cache.has(key2)).toBe(false);
    });
  });

  describe("triggerCollection", () => {
    beforeEach(() => {
      gc = new GarbageCollector({ checkInterval: 100 });
      gc.start(cache);
    });

    it("should immediately collect eligible entries", () => {
      const key = JSON.stringify(["test"]);
      const promise = Promise.resolve("data");
      const entry: CacheEntry = {
        promise: PromiseEntryFactory.create(promise, { gcTime: 1000 }),
        subscriptions: 0,
        gcTime: 1000,
        gcEligibleAt: Date.now() - 2000, // Eligible 2 seconds ago
      };

      cache.set(key, entry);

      // Trigger collection manually
      gc.triggerCollection();

      expect(cache.has(key)).toBe(false);
    });

    it("should work without waiting for scheduler", () => {
      const onCollect = vi.fn();
      gc.stop();
      gc = new GarbageCollector({ checkInterval: 100, onCollect });
      gc.start(cache);

      const key = JSON.stringify(["test"]);
      const promise = Promise.resolve("data");
      const entry: CacheEntry = {
        promise: PromiseEntryFactory.create(promise, { gcTime: 1000 }),
        subscriptions: 0,
        gcTime: 1000,
        gcEligibleAt: Date.now() - 2000,
      };

      cache.set(key, entry);

      // Trigger immediately without waiting for timer
      gc.triggerCollection();

      expect(onCollect).toHaveBeenCalledOnce();
      expect(cache.has(key)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty cache", () => {
      gc = new GarbageCollector({ checkInterval: 100 });
      gc.start(cache);

      expect(() => {
        vi.advanceTimersByTime(100);
        vi.advanceTimersByTime(1);
      }).not.toThrow();
    });

    it("should handle stopping before starting", () => {
      gc = new GarbageCollector();
      expect(() => gc.stop()).not.toThrow();
    });

    it("should handle triggering collection before starting", () => {
      gc = new GarbageCollector();
      expect(() => gc.triggerCollection()).not.toThrow();
    });

    it("should not collect if gcEligibleAt is in the future", () => {
      gc = new GarbageCollector({ checkInterval: 100 });
      gc.start(cache);

      const key = JSON.stringify(["test"]);
      const promise = Promise.resolve("data");
      const entry: CacheEntry = {
        promise: PromiseEntryFactory.create(promise, { gcTime: 1000 }),
        subscriptions: 0,
        gcTime: 1000,
        gcEligibleAt: Date.now() + 5000, // Eligible in 5 seconds
      };

      cache.set(key, entry);

      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(1);

      expect(cache.has(key)).toBe(true);
    });
  });
});
