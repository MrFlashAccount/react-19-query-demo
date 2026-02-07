import { beforeEach, describe, expect, it, vi } from "vitest";

import { PerformanceObserver } from "./PerformanceObserver";

describe("PerformanceObserver", () => {
  let rafId = 0;
  let rafCallbacks = new Map<number, FrameRequestCallback>();

  beforeEach(() => {
    rafId = 0;
    rafCallbacks = new Map();

    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        const id = ++rafId;
        rafCallbacks.set(id, cb);
        return id;
      }),
    );

    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((id: number) => {
        rafCallbacks.delete(id);
      }),
    );

    vi.spyOn(performance, "now").mockReturnValue(0);
  });

  it("initializes with defaults", () => {
    const observer = new PerformanceObserver();
    const metrics = observer.getMetrics();

    expect(observer.getLevel()).toBe(1);
    expect(observer.getTargetFps()).toBe(120);
    expect(metrics.targetFps).toBe(120);
    expect(metrics.jankCount).toBe(0);
  });

  it("starts and stops animation frame loop", () => {
    const observer = new PerformanceObserver({ level: 1 });

    observer.start();
    expect(requestAnimationFrame).toHaveBeenCalled();

    observer.stop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it("stops when level is set to zero and restarts on non-zero level", () => {
    const observer = new PerformanceObserver({ level: 1 });

    observer.start();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);

    observer.setLevel(0);
    expect(observer.getLevel()).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalled();

    observer.setLevel(2);
    expect(observer.getLevel()).toBe(2);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
  });

  it("returns history buffer metadata", () => {
    const observer = new PerformanceObserver();
    const history = observer.getHistory();

    expect(history.data).toBeInstanceOf(Float64Array);
    expect(history.count).toBe(0);
    expect(history.index).toBe(0);
  });
});
