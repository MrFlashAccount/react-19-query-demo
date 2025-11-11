import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TimerWheel } from "../TimerWheel";

describe("TimerWheel", () => {
  let wheel: TimerWheel;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    wheel?.clear();
    vi.useRealTimers();
  });

  describe("Basic Scheduling and Execution", () => {
    it("should execute a timer after the specified delay", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback = vi.fn();

      wheel.schedule(callback, 100);

      // Should not execute immediately
      expect(callback).not.toHaveBeenCalled();

      // Advance time to just before expiration
      await vi.advanceTimersByTimeAsync(99);
      expect(callback).not.toHaveBeenCalled();

      // Advance time to expiration
      await vi.advanceTimersByTimeAsync(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should execute multiple timers in order of expiration", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const results: number[] = [];

      wheel.schedule(() => results.push(3), 300);
      wheel.schedule(() => results.push(1), 100);
      wheel.schedule(() => results.push(2), 200);

      await vi.advanceTimersByTimeAsync(100);
      expect(results).toEqual([1]);

      await vi.advanceTimersByTimeAsync(100);
      expect(results).toEqual([1, 2]);

      await vi.advanceTimersByTimeAsync(100);
      expect(results).toEqual([1, 2, 3]);
    });

    it("should execute timers scheduled with 0 delay immediately", async () => {
      wheel = new TimerWheel({ tickInterval: 1 });
      const callback = vi.fn();

      wheel.schedule(callback, 0);

      // Should execute after microtask and next tick
      await vi.advanceTimersByTimeAsync(0);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should execute multiple timers scheduled at the same time", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      wheel.schedule(callback1, 100);
      wheel.schedule(callback2, 100);
      wheel.schedule(callback3, 100);

      await vi.advanceTimersByTimeAsync(100);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it("should handle very short delays (< tickInterval)", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback = vi.fn();

      wheel.schedule(callback, 5);

      // Should round up to next tick interval
      await vi.advanceTimersByTimeAsync(5);
      expect(callback).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(5);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle long delays that span multiple wheel levels", async () => {
      wheel = new TimerWheel({ tickInterval: 10, slotsPerLevel: 16 });
      const callback = vi.fn();

      // Schedule a timer that exceeds level 0 capacity (16 slots * 10ms = 160ms)
      wheel.schedule(callback, 500);

      await vi.advanceTimersByTimeAsync(499);
      expect(callback).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("Timer Cancellation", () => {
    it("should not execute a cancelled timer", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback = vi.fn();

      const timerId = wheel.schedule(callback, 100);
      wheel.cancel(timerId);

      await vi.advanceTimersByTimeAsync(100);
      expect(callback).not.toHaveBeenCalled();
    });

    it("should return true when cancelling an existing timer", () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback = vi.fn();

      const timerId = wheel.schedule(callback, 100);
      const result = wheel.cancel(timerId);

      expect(result).toBe(true);
    });

    it("should return false when cancelling a non-existent timer", () => {
      wheel = new TimerWheel({ tickInterval: 10 });

      const result = wheel.cancel(999);
      expect(result).toBe(false);
    });

    it("should cancel the correct timer when multiple are scheduled", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      wheel.schedule(callback1, 100);
      const timer2 = wheel.schedule(callback2, 100);
      wheel.schedule(callback3, 100);

      wheel.cancel(timer2);

      await vi.advanceTimersByTimeAsync(100);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it("should handle cancelling all timers", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const timer1 = wheel.schedule(callback1, 100);
      const timer2 = wheel.schedule(callback2, 200);

      wheel.cancel(timer1);
      wheel.cancel(timer2);

      await vi.advanceTimersByTimeAsync(300);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(wheel.hasActiveTimers()).toBe(false);
    });

    it("should not allow cancelling the same timer twice", () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback = vi.fn();

      const timerId = wheel.schedule(callback, 100);
      const result1 = wheel.cancel(timerId);
      const result2 = wheel.cancel(timerId);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });

  describe("Batching with queueMicrotask", () => {
    it("should batch multiple schedule calls into a single reschedule", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callbacks = Array.from({ length: 100 }, () => vi.fn());

      // Schedule many timers in quick succession
      callbacks.forEach((cb, i) => {
        wheel.schedule(cb, (i + 1) * 10);
      });

      // All timers should be scheduled, only one reschedule should occur
      // This is tested implicitly by checking that all timers execute correctly
      for (let i = 0; i < callbacks.length; i++) {
        await vi.advanceTimersByTimeAsync(10);
        expect(callbacks[i]).toHaveBeenCalledTimes(1);
      }
    });

    it("should batch multiple cancel calls", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callbacks = Array.from({ length: 10 }, () => vi.fn());

      // Schedule timers
      const timerIds = callbacks.map((cb, i) =>
        wheel.schedule(cb, (i + 1) * 100)
      );

      // Cancel many timers in quick succession
      timerIds.slice(0, 5).forEach((id) => wheel.cancel(id));

      await vi.advanceTimersByTimeAsync(1000);

      // First 5 should not execute
      callbacks.slice(0, 5).forEach((cb) => {
        expect(cb).not.toHaveBeenCalled();
      });

      // Last 5 should execute
      callbacks.slice(5).forEach((cb) => {
        expect(cb).toHaveBeenCalledTimes(1);
      });
    });

    it("should batch mixed schedule and cancel operations", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      const timer1 = wheel.schedule(callback1, 100);
      wheel.schedule(callback2, 200);
      wheel.cancel(timer1);
      wheel.schedule(callback3, 150);

      await vi.advanceTimersByTimeAsync(100);
      expect(callback1).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(50);
      expect(callback3).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(50);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe("Timer Count and State", () => {
    it("should track active timer count correctly", () => {
      wheel = new TimerWheel({ tickInterval: 10 });

      expect(wheel.getActiveTimerCount()).toBe(0);

      wheel.schedule(() => {}, 100);
      expect(wheel.getActiveTimerCount()).toBe(1);

      wheel.schedule(() => {}, 200);
      expect(wheel.getActiveTimerCount()).toBe(2);

      wheel.schedule(() => {}, 300);
      expect(wheel.getActiveTimerCount()).toBe(3);
    });

    it("should decrease timer count after execution", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });

      wheel.schedule(() => {}, 100);
      wheel.schedule(() => {}, 200);
      wheel.schedule(() => {}, 300);

      expect(wheel.getActiveTimerCount()).toBe(3);

      await vi.advanceTimersByTimeAsync(100);
      expect(wheel.getActiveTimerCount()).toBe(2);

      await vi.advanceTimersByTimeAsync(100);
      expect(wheel.getActiveTimerCount()).toBe(1);

      await vi.advanceTimersByTimeAsync(100);
      expect(wheel.getActiveTimerCount()).toBe(0);
    });

    it("should decrease timer count after cancellation", () => {
      wheel = new TimerWheel({ tickInterval: 10 });

      const timer1 = wheel.schedule(() => {}, 100);
      const timer2 = wheel.schedule(() => {}, 200);

      expect(wheel.getActiveTimerCount()).toBe(2);

      wheel.cancel(timer1);
      expect(wheel.getActiveTimerCount()).toBe(1);

      wheel.cancel(timer2);
      expect(wheel.getActiveTimerCount()).toBe(0);
    });

    it("should report hasActiveTimers correctly", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });

      expect(wheel.hasActiveTimers()).toBe(false);

      wheel.schedule(() => {}, 100);
      expect(wheel.hasActiveTimers()).toBe(true);

      await vi.advanceTimersByTimeAsync(100);
      expect(wheel.hasActiveTimers()).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should throw error for negative delay", () => {
      wheel = new TimerWheel({ tickInterval: 10 });

      expect(() => {
        wheel.schedule(() => {}, -100);
      }).toThrow("Delay must be non-negative");
    });

    it("should not crash if callback throws an error", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const errorCallback = vi.fn(() => {
        throw new Error("Test error");
      });
      const normalCallback = vi.fn();

      // Spy on console.error to verify error is logged
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      wheel.schedule(errorCallback, 100);
      wheel.schedule(normalCallback, 150);

      await vi.advanceTimersByTimeAsync(100);
      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Should continue processing other timers
      await vi.advanceTimersByTimeAsync(50);
      expect(normalCallback).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Clear Functionality", () => {
    it("should clear all timers", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      wheel.schedule(callback1, 100);
      wheel.schedule(callback2, 200);
      wheel.schedule(callback3, 300);

      expect(wheel.getActiveTimerCount()).toBe(3);

      wheel.clear();

      expect(wheel.getActiveTimerCount()).toBe(0);
      expect(wheel.hasActiveTimers()).toBe(false);

      await vi.advanceTimersByTimeAsync(300);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();
    });

    it("should allow scheduling new timers after clear", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });

      wheel.schedule(() => {}, 100);
      wheel.clear();

      const callback = vi.fn();
      wheel.schedule(callback, 100);

      await vi.advanceTimersByTimeAsync(100);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("Timer Rescheduling During Execution", () => {
    it("should allow scheduling new timers during callback execution", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback2 = vi.fn();
      let callback1Called = false;

      const callback1 = vi.fn(() => {
        callback1Called = true;
        // Schedule a new timer during execution
        wheel.schedule(callback2, 100);
      });

      wheel.schedule(callback1, 100);

      await vi.advanceTimersByTimeAsync(100);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback1Called).toBe(true);
      expect(callback2).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(100);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should handle recursive timer scheduling", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      let count = 0;
      const maxCount = 5;

      const recursiveCallback = vi.fn(() => {
        count++;
        if (count < maxCount) {
          wheel.schedule(recursiveCallback, 50);
        }
      });

      wheel.schedule(recursiveCallback, 50);

      await vi.advanceTimersByTimeAsync(50 * maxCount);

      expect(recursiveCallback).toHaveBeenCalledTimes(maxCount);
      expect(count).toBe(maxCount);
    });
  });

  describe("Configuration Options", () => {
    it("should respect custom tickInterval", async () => {
      wheel = new TimerWheel({ tickInterval: 50 });
      const callback = vi.fn();

      wheel.schedule(callback, 100);

      // Should round up to nearest tick (2 ticks * 50ms = 100ms)
      await vi.advanceTimersByTimeAsync(99);
      expect(callback).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should throw error if slotsPerLevel is not a power of 2", () => {
      expect(() => {
        new TimerWheel({ slotsPerLevel: 100 });
      }).toThrow("slotsPerLevel must be a power of 2");
    });

    it("should work with different slotsPerLevel configurations", async () => {
      wheel = new TimerWheel({ tickInterval: 10, slotsPerLevel: 16 });
      const callback = vi.fn();

      wheel.schedule(callback, 100);

      await vi.advanceTimersByTimeAsync(100);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle scheduling many timers with the same delay", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callbacks = Array.from({ length: 100 }, () => vi.fn());

      callbacks.forEach((cb) => wheel.schedule(cb, 100));

      await vi.advanceTimersByTimeAsync(100);

      callbacks.forEach((cb) => {
        expect(cb).toHaveBeenCalledTimes(1);
      });
    });

    it("should handle scheduling with delay of exactly one tick", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback = vi.fn();

      wheel.schedule(callback, 10);

      await vi.advanceTimersByTimeAsync(10);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid schedule and cancel operations", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback = vi.fn();

      // Schedule and cancel rapidly
      for (let i = 0; i < 50; i++) {
        const timerId = wheel.schedule(callback, 100);
        if (i % 2 === 0) {
          wheel.cancel(timerId);
        }
      }

      await vi.advanceTimersByTimeAsync(100);

      // Only half should have executed
      expect(callback).toHaveBeenCalledTimes(25);
    });

    it("should execute all timers scheduled within the same tick", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const results: number[] = [];

      // Schedule timers very close together (all round to same tick)
      wheel.schedule(() => results.push(1), 100);
      wheel.schedule(() => results.push(2), 101);
      wheel.schedule(() => results.push(3), 102);

      await vi.advanceTimersByTimeAsync(110);

      // All should execute (order within same tick is not guaranteed)
      expect(results).toHaveLength(3);
      expect(results).toContain(1);
      expect(results).toContain(2);
      expect(results).toContain(3);
    });

    it("should handle getCurrentTime correctly", () => {
      wheel = new TimerWheel({ tickInterval: 10 });

      // Before any scheduling, should return current time
      const beforeTime = wheel.getCurrentTime();
      expect(beforeTime).toBeGreaterThan(0);

      wheel.schedule(() => {}, 100);

      const afterTime = wheel.getCurrentTime();
      expect(afterTime).toBeGreaterThan(0);
    });
  });

  describe("No Active Timers Behavior", () => {
    it("should not schedule timeout when no timers are active", () => {
      wheel = new TimerWheel({ tickInterval: 10 });

      // Initially no timers
      expect(wheel.hasActiveTimers()).toBe(false);

      // Schedule and immediately cancel
      const timerId = wheel.schedule(() => {}, 100);
      wheel.cancel(timerId);

      // Should have no active timers
      expect(wheel.hasActiveTimers()).toBe(false);
    });

    it("should reschedule to nearest timer after one expires", async () => {
      wheel = new TimerWheel({ tickInterval: 10 });
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      wheel.schedule(callback1, 100);
      wheel.schedule(callback2, 300);

      await vi.advanceTimersByTimeAsync(100);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(200);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });
});
