import { createOncePerTick } from "../batcher";
/**
 * Options for configuring a Batcher instance
 */
export interface BatcherOptions<T> {
  /**
   * Callback invoked with all collected items when flush is executed
   */
  onFlush: (items: T[]) => void;
}

/**
 * A generic batcher that collects items and flushes them asynchronously
 * using requestIdleCallback to avoid blocking the main thread.
 *
 * @example
 * ```ts
 * const batcher = new Batcher<string>({
 *   onFlush: (items) => {
 *     console.log('Processing:', items);
 *   }
 * });
 *
 * batcher.push('event1');
 * batcher.push('event2');
 * batcher.flush(); // Items will be processed in requestIdleCallback
 * ```
 */
export class Batcher<T> {
  private items: T[] = [];
  private readonly onFlush: (items: T[]) => void;
  private readonly oncePerTick = createOncePerTick({
    tickMethod:
      typeof requestIdleCallback === "function"
        ? requestIdleCallback
        : setTimeout,
  });

  constructor(options: BatcherOptions<T>) {
    this.onFlush = options.onFlush;
  }

  /**
   * Add an item to the batch
   */
  push(item: T | T[]): void {
    if (Array.isArray(item)) {
      this.items.push(...item);
    } else {
      this.items.push(item);
    }
  }

  /**
   * Schedule processing of all collected items via requestIdleCallback.
   * If no items have been collected, this is a no-op.
   */
  flush(): void {
    if (this.items.length === 0) {
      return;
    }

    const itemsToFlush = this.items;
    this.clear();
    this.oncePerTick(() => this.onFlush(itemsToFlush));
  }

  /**
   * Process all collected items synchronously.
   * Use this when immediate processing is required.
   */
  flushSync(): void {
    if (this.items.length === 0) {
      return;
    }

    const itemsToFlush = this.items;
    this.clear();
    this.onFlush(itemsToFlush);
  }

  /**
   * Clear all collected items without processing them
   */
  clear(): void {
    this.items = [];
  }
}
