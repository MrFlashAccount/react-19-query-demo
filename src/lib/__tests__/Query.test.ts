import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Query } from "../Query";
import { timerWheel as defaultTimerWheel } from "../TimerWheel";
import type { TimerWheel } from "../TimerWheel";

describe("Query", () => {
  let timerWheel: TimerWheel;

  beforeEach(() => {
    vi.useFakeTimers();
    defaultTimerWheel.clear();
    timerWheel = defaultTimerWheel;
  });

  afterEach(() => {
    timerWheel.clear();
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("should create query with required options", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn });

      expect(query).toBeDefined();
      expect(query.getKey()).toEqual(["user", 1]);
      expect(query.getState().status).toBe("pending");
      expect(query.getState().fetchStatus).toBe("idle");
    });

    it("should merge default options with provided options", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const defaultOptions = {
        gcTime: 5000,
        staleTime: 1000,
        retry: 3,
      };

      const query = new Query(
        { key: ["user", 1], queryFn, staleTime: 2000 },
        defaultOptions
      );

      const options = query.getOptions();
      expect(options.gcTime).toBe(5000); // from defaults
      expect(options.staleTime).toBe(2000); // overridden
      expect(options.retry).toBe(3); // from defaults
    });

    it("should prioritize provided options over defaults", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query(
        { key: ["user", 1], queryFn, gcTime: 1000, retry: 5 },
        { gcTime: 5000, retry: 3 }
      );

      const options = query.getOptions();
      expect(options.gcTime).toBe(1000);
      expect(options.retry).toBe(5);
    });
  });

  describe("state management", () => {
    it("should update state after successful fetch", async () => {
      const queryFn = vi.fn().mockResolvedValue("success data");
      const query = new Query({ key: ["user", 1], queryFn });

      await query.fetch();

      const state = query.getState();
      expect(state.status).toBe("success");
      expect(state.data).toBe("success data");
      expect(state.error).toBeUndefined();
      expect(state.dataUpdatedAt).toBeDefined();
      expect(state.fetchStatus).toBe("idle");
    });

    it("should update state after failed fetch", async () => {
      const error = new Error("fetch failed");
      const queryFn = vi.fn().mockRejectedValue(error);
      const query = new Query({ key: ["user", 1], queryFn, retry: false });

      await expect(query.fetch()).rejects.toThrow("fetch failed");

      const state = query.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe(error);
      expect(state.errorUpdatedAt).toBeDefined();
      expect(state.fetchStatus).toBe("idle");
    });

    it("should set fetchStatus to fetching during fetch", async () => {
      const queryFn = vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve("data"), 1000);
          })
      );
      const query = new Query({ key: ["user", 1], queryFn });

      // Query must be subscribed for fetch to work
      query.subscribe(vi.fn());

      await vi.advanceTimersByTimeAsync(0);
      expect(query.getState().fetchStatus).toBe("fetching");

      await vi.advanceTimersByTimeAsync(1000);

      expect(query.getState().fetchStatus).toBe("idle");
    });
  });

  describe("fetch", () => {
    it("should fetch data using queryFn", async () => {
      const queryFn = vi.fn().mockResolvedValue("test data");
      const query = new Query({ key: ["user", 1], queryFn });

      const result = await query.fetch();

      expect(result).toBe("test data");
      expect(queryFn).toHaveBeenCalledWith(["user", 1]);
      expect(queryFn).toHaveBeenCalledOnce();
    });

    it("should handle refetch with invalidate", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({
        key: ["user", 1],
        queryFn,
        staleTime: Infinity,
      });

      // Subscribe to enable fetching
      query.subscribe(vi.fn());

      await vi.advanceTimersByTimeAsync(0);
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Invalidate triggers new fetch
      query.invalidate();

      // Need to wait for the new fetch to start
      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(0);
      expect(queryFn).toHaveBeenCalledTimes(2);
    });

    it("should use retrier for retries", async () => {
      const queryFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("success");

      const query = new Query({ key: ["user", 1], queryFn, retry: 3 });

      const result = await query.fetch();

      expect(result).toBe("success");
      expect(queryFn).toHaveBeenCalledTimes(3);
    });

    it("should notify subscribers on fetch completion", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn });

      const subscriber = vi.fn();
      query.subscribe(subscriber);

      // Initial subscribe triggers notification for pending queries
      expect(subscriber).toHaveBeenCalledTimes(1);

      await query.fetch();
      await vi.advanceTimersByTimeAsync(0);

      // Should notify on status change during fetch
      expect(subscriber).toHaveBeenCalledTimes(3); // fetching state + success state
    });

    it("should handle fetch errors correctly", async () => {
      const error = new Error("network error");
      const queryFn = vi.fn().mockRejectedValue(error);
      const query = new Query({ key: ["user", 1], queryFn, retry: false });

      await expect(query.fetch()).rejects.toThrow("network error");

      const state = query.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe(error);
    });
  });

  describe("staleness checking", () => {
    it("should be stale if no data fetched yet", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn });

      expect(query.isStale()).toBe(true);
    });

    it("should not be stale with static staleTime", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({
        key: ["user", 1],
        queryFn,
        staleTime: "static",
      });

      await query.fetch();

      expect(query.isStale()).toBe(false);
    });

    it("should not be stale with Infinity staleTime", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({
        key: ["user", 1],
        queryFn,
        staleTime: Infinity,
      });

      await query.fetch();

      expect(query.isStale()).toBe(false);
    });

    it("should be stale with staleTime: 0", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, staleTime: 0 });

      await query.fetch();

      expect(query.isStale()).toBe(true);
    });

    it("should be stale after staleTime elapsed", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, staleTime: 5000 });

      await query.fetch();

      expect(query.isStale()).toBe(false);

      vi.advanceTimersByTime(5000);

      expect(query.isStale()).toBe(true);
    });

    it("should not be stale before staleTime elapsed", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, staleTime: 5000 });

      await query.fetch();

      vi.advanceTimersByTime(4999);

      expect(query.isStale()).toBe(false);

      vi.advanceTimersByTime(1);

      expect(query.isStale()).toBe(true);
    });
  });

  describe("subscribers", () => {
    it("should add and track subscribers", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn });

      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();

      query.subscribe(subscriber1);
      expect(query.getSubscriberCount()).toBe(1);

      query.subscribe(subscriber2);
      expect(query.getSubscriberCount()).toBe(2);
    });

    it("should remove subscribers via unsubscribe function", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn });

      const subscriber = vi.fn();
      const unsubscribe = query.subscribe(subscriber);

      expect(query.getSubscriberCount()).toBe(1);

      unsubscribe();

      expect(query.getSubscriberCount()).toBe(0);
    });

    it("should notify subscribers on state changes", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn });

      const subscriber = vi.fn();
      query.subscribe(subscriber);

      // Initial subscribe triggers notification for pending queries
      expect(subscriber).toHaveBeenCalledTimes(1);

      await query.fetch();
      await vi.advanceTimersByTimeAsync(0);

      expect(subscriber).toHaveBeenCalledTimes(3); // fetching + success states
    });

    it("should not throw if subscriber throws", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn });

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const badSubscriber = vi.fn(() => {
        throw new Error("subscriber error");
      });

      query.subscribe(badSubscriber);

      await expect(query.fetch()).resolves.toBe("data");

      errorSpy.mockRestore();
    });

    it("should trigger refetch on subscribe if stale and successful", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, staleTime: 1000 });

      // Initial fetch
      await query.fetch();
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Make data stale
      vi.advanceTimersByTime(1000);

      // Subscribe should trigger refetch
      const subscriber = vi.fn();
      query.subscribe(subscriber);

      await vi.advanceTimersByTimeAsync(0);

      expect(queryFn).toHaveBeenCalledTimes(2);
    });

    it("should not refetch on subscribe if not stale", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, staleTime: 5000 });

      await query.fetch();
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Subscribe while still fresh
      const subscriber = vi.fn();
      query.subscribe(subscriber);

      await vi.advanceTimersByTimeAsync(0);

      expect(queryFn).toHaveBeenCalledTimes(1); // No refetch
    });

    it("should not refetch on subscribe if query has error", async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error("fail"));
      const query = new Query({ key: ["user", 1], queryFn, retry: false });

      await expect(query.fetch()).rejects.toThrow("fail");
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Subscribe should not trigger refetch on error state
      const subscriber = vi.fn();
      query.subscribe(subscriber);

      await vi.advanceTimersByTimeAsync(0);

      expect(queryFn).toHaveBeenCalledTimes(1); // No refetch
    });
  });

  describe("garbage collection", () => {
    it("should schedule GC when last subscriber unsubscribes", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, gcTime: 5000 });

      const unsubscribe = query.subscribe(vi.fn());

      expect(timerWheel.hasActiveTimers()).toBe(false);

      unsubscribe();

      expect(timerWheel.hasActiveTimers()).toBe(true);
    });

    it("should not schedule GC with Infinity gcTime", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({
        key: ["user", 1],
        queryFn,
        gcTime: Infinity,
      });

      const unsubscribe = query.subscribe(vi.fn());
      unsubscribe();

      expect(timerWheel.hasActiveTimers()).toBe(false);
    });

    it("should cancel GC when new subscriber added", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, gcTime: 5000 });

      const unsubscribe1 = query.subscribe(vi.fn());
      unsubscribe1();

      expect(timerWheel.hasActiveTimers()).toBe(true);

      // Add new subscriber
      query.subscribe(vi.fn());

      expect(timerWheel.hasActiveTimers()).toBe(false);
    });

    it("should be eligible for GC after gcTime elapsed", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, gcTime: 5000 });

      const unsubscribe = query.subscribe(vi.fn());

      // Complete the initial fetch
      await vi.advanceTimersByTimeAsync(0);

      expect(query.canBeCollected()).toBe(false);

      unsubscribe();

      // Allow time for GC timer to be scheduled
      await vi.advanceTimersByTimeAsync(0);

      // Timer is scheduled, not eligible yet
      expect(query.canBeCollected()).toBe(false);
      expect(timerWheel.hasActiveTimers()).toBe(true);

      // Advance time to trigger the timer
      await vi.advanceTimersByTimeAsync(5000);

      // Now eligible after timer fired
      expect(timerWheel.hasActiveTimers()).toBe(false);
      expect(query.canBeCollected()).toBe(true);
    });

    it("should not be eligible for GC with active subscribers", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, gcTime: 5000 });

      query.subscribe(vi.fn());

      expect(query.canBeCollected()).toBe(false);

      vi.advanceTimersByTime(10000);

      expect(query.canBeCollected()).toBe(false);
    });
  });

  describe("options management", () => {
    it("should return copy of options", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn });

      const options1 = query.getOptions();
      const options2 = query.getOptions();

      expect(options1).toEqual(options2);
    });

    it("should update options", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, gcTime: 5000 });

      query.setOptions({ gcTime: 10000, staleTime: 2000 });

      const options = query.getOptions();
      expect(options.gcTime).toBe(10000);
      expect(options.staleTime).toBe(2000);
    });

    it("should update retrier when retry options change", async () => {
      const queryFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("success");

      const query = new Query({ key: ["user", 1], queryFn, retry: false });

      // Update to allow retries
      query.setOptions({ retry: 3 });

      // Subscribe to enable fetching
      query.subscribe(vi.fn());

      // Should retry now
      await vi.advanceTimersByTimeAsync(0);
      const state = query.getState();
      expect(state.status).toBe("success");
      expect(state.data).toBe("success");
    });
  });

  describe("invalidation", () => {
    it("should reset dataUpdatedAt on invalidate", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, staleTime: 5000 });

      await query.fetch();

      expect(query.isStale()).toBe(false);

      query.invalidate();

      expect(query.isStale()).toBe(true);
    });

    it("should trigger refetch if subscribers exist", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, staleTime: 5000 });

      // Subscribe first to enable fetching
      query.subscribe(vi.fn());

      await vi.advanceTimersByTimeAsync(0);
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Invalidate triggers refetch
      query.invalidate();

      // Wait for new fetch to execute
      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(0);

      expect(queryFn).toHaveBeenCalledTimes(2);
    });

    it("should not trigger refetch if no subscribers", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, staleTime: 5000 });

      await query.fetch();
      expect(queryFn).toHaveBeenCalledTimes(1);

      query.invalidate();

      await vi.advanceTimersByTimeAsync(0);

      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it("should not invalidate queries with static staleTime", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({
        key: ["user", 1],
        queryFn,
        staleTime: "static",
      });

      await query.fetch();

      expect(query.isStale()).toBe(false);

      query.invalidate();

      expect(query.isStale()).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset query to initial state", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn });

      await query.fetch();

      expect(query.getState().status).toBe("success");
      expect(query.getState().data).toBe("data");

      query.reset();

      const state = query.getState();
      expect(state.status).toBe("pending");
      expect(state.data).toBeUndefined();
      expect(state.error).toBeUndefined();
      expect(state.fetchStatus).toBe("idle");
    });

    it("should notify subscribers on reset", async () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn });

      const subscriber = vi.fn();
      query.subscribe(subscriber);

      // Wait for initial fetch to complete
      await vi.advanceTimersByTimeAsync(0);

      subscriber.mockClear();

      query.reset();

      // Reset notifies subscribers
      expect(subscriber).toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("should clean up resources", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, gcTime: 5000 });

      const unsubscribe = query.subscribe(vi.fn());
      unsubscribe();

      expect(timerWheel.hasActiveTimers()).toBe(true);

      query.destroy();

      expect(query.getSubscriberCount()).toBe(0);
      expect(timerWheel.hasActiveTimers()).toBe(false);
    });

    it("should clear all subscribers", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn });

      query.subscribe(vi.fn());
      query.subscribe(vi.fn());

      expect(query.getSubscriberCount()).toBe(2);

      query.destroy();

      expect(query.getSubscriberCount()).toBe(0);
    });
  });

  describe("type safety", () => {
    it("should preserve data type", async () => {
      type User = { id: number; name: string };
      const queryFn = vi.fn<() => Promise<User>>().mockResolvedValue({
        id: 1,
        name: "John",
      });

      const query = new Query<[string, number], User>({
        key: ["user", 1],
        queryFn,
      });

      const result = await query.fetch();

      expect(result.id).toBe(1);
      expect(result.name).toBe("John");

      const state = query.getState();
      expect(state.data?.id).toBe(1);
      expect(state.data?.name).toBe("John");
    });
  });

  describe("edge cases", () => {
    it("should handle multiple rapid subscribes/unsubscribes", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn, gcTime: 5000 });

      const unsubscribe1 = query.subscribe(vi.fn());
      const unsubscribe2 = query.subscribe(vi.fn());
      const unsubscribe3 = query.subscribe(vi.fn());

      expect(query.getSubscriberCount()).toBe(3);

      unsubscribe1();
      expect(query.getSubscriberCount()).toBe(2);

      unsubscribe2();
      expect(query.getSubscriberCount()).toBe(1);

      unsubscribe3();
      expect(query.getSubscriberCount()).toBe(0);
      expect(timerWheel.hasActiveTimers()).toBe(true);
    });

    it("should handle calling unsubscribe multiple times", () => {
      const queryFn = vi.fn().mockResolvedValue("data");
      const query = new Query({ key: ["user", 1], queryFn });

      const unsubscribe = query.subscribe(vi.fn());

      expect(query.getSubscriberCount()).toBe(1);

      unsubscribe();
      expect(query.getSubscriberCount()).toBe(0);

      unsubscribe();
      expect(query.getSubscriberCount()).toBe(0);
    });

    it("should handle subscription-based fetching correctly", async () => {
      const queryFn = vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve("data"), 1000);
          })
      );
      const query = new Query({ key: ["user", 1], queryFn });

      // Multiple subscribers share the same fetch
      const unsub1 = query.subscribe(vi.fn());
      const unsub2 = query.subscribe(vi.fn());
      const unsub3 = query.subscribe(vi.fn());

      // All subscribers trigger only one fetch
      await vi.advanceTimersByTimeAsync(1000);

      expect(query.getState().status).toBe("success");
      expect(queryFn).toHaveBeenCalledOnce();

      unsub1();
      unsub2();
      unsub3();
    });
  });
});
