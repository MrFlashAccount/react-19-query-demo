import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GarbageCollector,
  type IGarbageCollectable,
} from "../GarbageCollector";
import { timerWheel } from "../TimerWheel";

interface CollectableOptions {
  gcTime?: number;
  canCollect?: boolean;
  removeReturns?: boolean;
}

const createCollectable = ({
  gcTime = 1000,
  canCollect = true,
  removeReturns = true,
}: CollectableOptions = {}): IGarbageCollectable & {
  remove: ReturnType<typeof vi.fn>;
  canBeCollected: ReturnType<typeof vi.fn>;
} => {
  return {
    gcTime,
    canBeCollected: vi.fn().mockReturnValue(canCollect),
    remove: vi.fn().mockReturnValue(removeReturns),
  };
};

const flushTimerWheel = async (ms: number): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
  if (ms > 0) {
    await vi.advanceTimersByTimeAsync(ms);
  }
  await vi.advanceTimersByTimeAsync(0);
};

describe("GarbageCollector", () => {
  let gc: GarbageCollector;

  beforeEach(() => {
    vi.useFakeTimers();
    timerWheel.clear();
    gc = new GarbageCollector();
  });

  afterEach(() => {
    timerWheel.clear();
    vi.useRealTimers();
  });

  describe("add", () => {
    it("should schedule collection and collect eligible entries", async () => {
      const onCollect = vi.fn();
      gc = new GarbageCollector({ onCollect });

      const entry = createCollectable();
      gc.add(entry);

      await flushTimerWheel(1000);

      expect(entry.canBeCollected).toHaveBeenCalledTimes(1);
      expect(entry.remove).toHaveBeenCalledTimes(1);
      expect(onCollect).toHaveBeenCalledWith(entry);
    });

    it("should not collect when entry cannot be collected", async () => {
      const entry = createCollectable({ canCollect: false });
      gc.add(entry);

      await flushTimerWheel(1000);

      expect(entry.canBeCollected).toHaveBeenCalledTimes(1);
      expect(entry.remove).not.toHaveBeenCalled();
    });

    it("should remove entry from schedule when removed manually", async () => {
      const entry = createCollectable();
      gc.add(entry);

      gc.remove(entry);
      await flushTimerWheel(1000);

      expect(entry.remove).not.toHaveBeenCalled();
    });

    it("should not invoke onCollect when remove returns false", async () => {
      const onCollect = vi.fn();
      gc = new GarbageCollector({ onCollect });

      const entry = createCollectable({ removeReturns: false });
      gc.add(entry);

      await flushTimerWheel(1000);

      expect(entry.remove).toHaveBeenCalledTimes(1);
      expect(onCollect).not.toHaveBeenCalled();
    });
  });

  describe("forceCollect", () => {
    it("should collect eligible entries immediately", () => {
      const entry = createCollectable();
      gc.add(entry);

      gc.forceCollect();

      expect(entry.canBeCollected).toHaveBeenCalledTimes(1);
      expect(entry.remove).toHaveBeenCalledTimes(1);
    });

    it("should only collect entries once", () => {
      const entry = createCollectable();
      gc.add(entry);

      gc.forceCollect();
      entry.remove.mockClear();

      gc.forceCollect();

      expect(entry.remove).not.toHaveBeenCalled();
    });

    it("should skip entries that cannot be collected", () => {
      const entry = createCollectable({ canCollect: false });
      gc.add(entry);

      gc.forceCollect();

      expect(entry.canBeCollected).toHaveBeenCalledTimes(1);
      expect(entry.remove).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should be idempotent", async () => {
      const entry = createCollectable();
      gc.add(entry);

      gc.remove(entry);
      gc.remove(entry);

      await flushTimerWheel(1000);

      expect(entry.remove).not.toHaveBeenCalled();
    });
  });
});
