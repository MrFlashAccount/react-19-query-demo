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

  /**
   * Schedule a draw callback to be executed on next animation frame.
   * Multiple calls within the same frame are batched together.
   */
  schedule(callback: DrawCallback): void {
    this.batcher.push(callback);

    if (!this.rafScheduled) {
      this.rafScheduled = true;
      requestAnimationFrame(() => {
        this.rafScheduled = false;
        this.batcher.flushSync();
      });
    }
  }
}

export const drawScheduler = new DrawScheduler();
