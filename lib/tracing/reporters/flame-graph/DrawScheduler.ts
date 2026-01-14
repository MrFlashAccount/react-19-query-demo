import { Batcher } from "../../Batcher";

type DrawCallback = () => void;

/**
 * Global draw scheduler for flame graph components.
 * Batches all draw requests and flushes them once per animation frame.
 */
class DrawScheduler {
  private batcher = new Batcher<DrawCallback>({
    process: (callbacks) => {
      for (const cb of callbacks) {
        cb();
      }
    },
  });

  private rafScheduled = false;
  private isRafRunning = false;
  private rafId: number = -1;

  stop(): void {
    this.cancelRaf();
    this.batcher.clear();
  }

  /**
   * Schedule a draw callback to be executed on next animation frame.
   * Multiple calls within the same frame are batched together.
   */
  schedule(callback: DrawCallback) {
    this.batcher.push(callback);

    // If the RAF is already running, flush the batcher synchronously,
    // no need to schedule another RAF
    if (this.isRafRunning) {
      this.batcher.flushSync();
    }

    if (!this.rafScheduled) {
      this.rafScheduled = true;
      this.rafId = requestAnimationFrame(() => {
        this.isRafRunning = true;
        this.batcher.flushSync();

        this.isRafRunning = false;
        this.rafScheduled = false;
        this.rafId = -1;
      });
    }
  }

  private cancelRaf(): void {
    if (this.rafId === -1) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = -1;
  }
}

export const drawScheduler = new DrawScheduler();
