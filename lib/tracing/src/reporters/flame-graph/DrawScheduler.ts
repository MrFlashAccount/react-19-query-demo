import { Batcher } from "../../Batcher";

type DrawCallback = () => void;

const enum Statuses {
  stopped,
  running,
  scheduled,
  flushing,
}

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

  private status: Statuses = Statuses.running;

  stop(): void {
    this.batcher.clear();
    this.status = Statuses.stopped;
  }

  /**
   * Schedule a draw callback to be executed on next animation frame.
   * Multiple calls within the same frame are batched together.
   */
  schedule(callback: DrawCallback) {
    if (this.status === Statuses.stopped) {
      return;
    }

    this.batcher.push(callback);
    // If the RAF is already running, flush the batcher synchronously,
    // no need to schedule another RAF
    if (this.status === Statuses.flushing) {
      this.batcher.flush({ sync: true });
    }

    if (this.status === Statuses.running) {
      this.status = Statuses.scheduled;
      queueMicrotask(() => {
        this.status = Statuses.flushing;
        queueMicrotask(() => {
          this.batcher.flush({ sync: true });
          this.status = Statuses.running;
        });
      });
    }
  }
}

export const drawScheduler = new DrawScheduler();
