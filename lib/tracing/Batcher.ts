/**
 * Options for configuring a Batcher instance
 */
export interface BatcherOptions<T> {
  /**
   * Callback invoked with all collected items when flush is executed
   */
  process: (items: T[]) => void;
  /**
   * Maximum number of items to collect before automatically flushing
   */
  maxItems?: number;

  /**
   * Scheduler to use for flushing the batch
   * @default "default"
   */
  scheduler?:
    | "default"
    | "requestIdleCallback"
    | "requestAnimationFrame"
    | "setTimeout"
    | "microtask";
}

export interface FlushOptions {
  force?: boolean;
  sync?: boolean;
}

/**
 * A generic batcher that collects items and flushes them asynchronously
 * using requestIdleCallback to avoid blocking the main thread.
 *
 * @example
 * ```ts
 * const batcher = new Batcher<string>({
 *   process: (items) => {
 *     console.log('Processing:', items);
 *   }
 * });
 *
 * batcher.push('event1');
 * batcher.push('event2');
 * batcher.flushSync(); // Items will be processed immediately
 * batcher.flush(); // Items will be processed in next tick
 * ```
 */
export class Batcher<T> {
  private items: T[] = [];
  private processingItems: T[] = [];

  private readonly maxItems: number;
  private readonly process: (items: T[]) => void;
  private readonly schedule: () => void;

  constructor(options: BatcherOptions<T>) {
    this.process = options.process;
    this.maxItems = options.maxItems ?? Infinity;
    const schedulerType = options.scheduler ?? "default";
    this.schedule = schedulerByType[schedulerType].create(() => {
      const clone = [...this.processingItems];
      this.processingItems = [];

      this.process(clone);
    });
  }

  /**
   * Add an item or items to the batch
   */
  push(item: T | T[]): void {
    if (Array.isArray(item)) {
      this.items.push(...item);
    } else {
      this.items.push(item);
    }
    // If the batch has reached the maximum number of items, flush it
    if (this.items.length >= this.maxItems) {
      this.flush();
    }
  }

  /**
   * Schedule processing of all collected items via requestIdleCallback.
   * If no items have been collected, this is a no-op.
   */
  flush(options: FlushOptions = {}): void {
    const { force = false, sync = false } = options;

    if (this.items.length === 0 && !force) {
      return;
    }

    this.processingItems = [...this.items];
    this.items = [];

    if (sync) {
      this.process(this.processingItems);
    } else {
      this.schedule();
    }
  }

  /**
   * Process all collected items synchronously.
   * Use this when immediate processing is required.
   * @deprecated Use flush({ sync: true }) instead.
   */
  flushSync(options: FlushOptions = {}): void {
    this.flush({ ...options, sync: true });
  }

  /**
   * Clear all collected items without processing them
   */
  clear(): void {
    this.items = [];
    this.processingItems = [];
  }
}

const schedulerByType: Record<
  NonNullable<BatcherOptions<unknown>["scheduler"]>,
  {
    create: (callback: () => void) => () => void;
  }
> = {
  default: {
    create: (callback: () => void) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        callback();
      };
      return () => channel.port2.postMessage(undefined);
    },
  },
  requestIdleCallback: {
    create: (callback: () => void) => {
      const ric =
        typeof requestIdleCallback === "function"
          ? requestIdleCallback
          : setTimeout;
      return () => {
        ric(callback);
      };
    },
  },
  requestAnimationFrame: {
    create: (callback: () => void) => {
      return () => requestAnimationFrame(callback);
    },
  },
  setTimeout: {
    create: (callback: () => void) => {
      return () => setTimeout(callback, 0);
    },
  },
  microtask: {
    create: (callback: () => void) => {
      return () => queueMicrotask(callback);
    },
  },
};
