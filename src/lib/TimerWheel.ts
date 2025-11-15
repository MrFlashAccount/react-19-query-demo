import { createBatcher } from "./utils";

/**
 * Timer entry in the heap
 */
interface TimerEntry {
  /** Timer ID */
  id: number;
  /** Callback function to execute */
  callback: () => void;
  /** Absolute expiration time in milliseconds */
  expirationTime: number;
}

/**
 * Options for TimerWheel configuration
 */
export interface TimerWheelOptions {
  /** Minimum delay between processing in milliseconds (default: 0) */
  minDelay?: number;
}

/**
 * Simple timer implementation using a min-heap (priority queue)
 *
 * Features:
 * - Only schedules timeout when there are active timers (lazy scheduling)
 * - Processes only expired timers (efficient execution)
 * - O(log n) schedule/cancel, O(1) lookup
 * - Works with both real and fake timers (testing-friendly)
 *
 * @example
 * ```typescript
 * const wheel = new TimerWheel();
 * const timerId = wheel.schedule(() => console.log('Hello'), 1000);
 * // Timer automatically schedules itself
 * // ... later
 * wheel.cancel(timerId);
 * // Timer automatically cancels if no active timers remain
 * ```
 */
export class TimerWheel {
  /** Minimum delay between processing in milliseconds */
  private readonly minDelay: number;

  /** Min-heap of timers sorted by expiration time */
  private heap: TimerEntry[] = [];
  /** Map from timer ID to heap index for O(1) lookup/cancellation */
  private timerIndexMap: Map<number, number> = new Map();
  /** Next timer ID */
  private nextTimerId: number = 1;
  private batch = createBatcher();

  /** Timeout handle for the next scheduled timer */
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(options: TimerWheelOptions = {}) {
    this.minDelay = options.minDelay ?? 0;
  }

  /**
   * Schedule a callback to execute after the specified delay
   *
   * @param callback - Function to execute
   * @param delayMs - Delay in milliseconds
   * @returns Timer ID that can be used to cancel the timer
   */
  schedule(callback: () => void, delayMs: number): number {
    if (delayMs < 0) {
      throw new Error("Delay must be non-negative");
    }

    const timerId = this.nextTimerId++;
    const expirationTime = Date.now() + delayMs;

    const entry: TimerEntry = {
      id: timerId,
      callback,
      expirationTime,
    };

    // Add to heap
    this.heapPush(entry);

    this.batch(() => {
      // Reschedule immediately
      this.reschedule();
    });

    return timerId;
  }

  /**
   * Cancel a scheduled timer
   *
   * @param timerId - Timer ID returned from schedule()
   * @returns True if the timer was found and cancelled
   */
  cancel(timerId: number): boolean {
    const index = this.timerIndexMap.get(timerId);
    if (index == null) {
      return false;
    }

    // Remove from heap
    this.heapRemove(index);

    this.batch(() => {
      // Reschedule immediately
      this.reschedule();
    });

    return true;
  }

  /**
   * Get the current time in milliseconds
   */
  getCurrentTime(): number {
    return Date.now();
  }

  /**
   * Reschedule the timeout to the next timer
   */
  private reschedule(): void {
    // Cancel existing timeout
    if (this.timeoutId != null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // If no active timers, don't schedule anything
    if (this.heap.length === 0) {
      return;
    }

    // Peek at the earliest timer (heap root)
    const earliest = this.heap[0]!;
    const now = Date.now();
    const delay = Math.max(this.minDelay, earliest.expirationTime - now);

    // Schedule timeout to process timers at that time
    this.timeoutId = setTimeout(() => {
      this.processTimers();
    }, delay);
  }

  /**
   * Process all expired timers
   */
  private processTimers(): void {
    this.timeoutId = null;

    const now = Date.now();
    const expiredCallbacks: Array<() => void> = [];

    // Pop all expired timers from the heap
    while (this.heap.length > 0) {
      const earliest = this.heap[0]!;
      if (earliest.expirationTime > now) {
        break; // No more expired timers
      }

      // Remove from heap
      this.heapPop();

      // Collect callback to execute
      expiredCallbacks.push(earliest.callback);
    }

    // Execute all expired callbacks
    for (const callback of expiredCallbacks) {
      try {
        callback();
      } catch (error) {
        // Log error but don't throw to prevent breaking the timer
        console.error("Timer callback error:", error);
      }
    }

    // Reschedule if there are more timers
    if (this.heap.length > 0) {
      this.batch(() => {
        this.reschedule();
      });
    }
  }

  /**
   * Get the number of active timers
   */
  getActiveTimerCount(): number {
    return this.heap.length;
  }

  /**
   * Check if there are any active timers
   */
  hasActiveTimers(): boolean {
    return this.heap.length > 0;
  }

  /**
   * Clear all timers and cancel any scheduled timeouts
   */
  clear(): void {
    // Cancel timeout immediately
    if (this.timeoutId != null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Clear heap and maps
    this.heap = [];
    this.timerIndexMap.clear();
  }

  /**
   * Add a timer to the heap
   */
  private heapPush(entry: TimerEntry): void {
    const index = this.heap.length;
    this.heap.push(entry);
    this.timerIndexMap.set(entry.id, index);
    this.heapBubbleUp(index);
  }

  /**
   * Remove and return the earliest timer (root of heap)
   */
  private heapPop(): TimerEntry | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }

    const root = this.heap[0]!;
    this.timerIndexMap.delete(root.id);

    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.timerIndexMap.set(last.id, 0);
      this.heapBubbleDown(0);
    }

    return root;
  }

  /**
   * Remove a timer at a specific index
   */
  private heapRemove(index: number): void {
    if (index >= this.heap.length) {
      return;
    }

    const entry = this.heap[index]!;
    this.timerIndexMap.delete(entry.id);

    const last = this.heap.pop()!;
    if (index < this.heap.length) {
      this.heap[index] = last;
      this.timerIndexMap.set(last.id, index);

      // Bubble up or down as needed
      const parent = Math.floor((index - 1) / 2);
      if (
        index > 0 &&
        this.heap[index]!.expirationTime < this.heap[parent]!.expirationTime
      ) {
        this.heapBubbleUp(index);
      } else {
        this.heapBubbleDown(index);
      }
    }
  }

  /**
   * Move a timer up the heap to maintain heap property
   */
  private heapBubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const current = this.heap[index]!;
      const parent = this.heap[parentIndex]!;

      if (current.expirationTime >= parent.expirationTime) {
        break;
      }

      // Swap
      this.heap[index] = parent;
      this.heap[parentIndex] = current;
      this.timerIndexMap.set(parent.id, index);
      this.timerIndexMap.set(current.id, parentIndex);

      index = parentIndex;
    }
  }

  /**
   * Move a timer down the heap to maintain heap property
   */
  private heapBubbleDown(index: number): void {
    const length = this.heap.length;

    while (true) {
      const leftIndex = 2 * index + 1;
      const rightIndex = 2 * index + 2;
      let smallestIndex = index;

      if (
        leftIndex < length &&
        this.heap[leftIndex]!.expirationTime <
          this.heap[smallestIndex]!.expirationTime
      ) {
        smallestIndex = leftIndex;
      }

      if (
        rightIndex < length &&
        this.heap[rightIndex]!.expirationTime <
          this.heap[smallestIndex]!.expirationTime
      ) {
        smallestIndex = rightIndex;
      }

      if (smallestIndex === index) {
        break;
      }

      // Swap
      const current = this.heap[index]!;
      const smallest = this.heap[smallestIndex]!;
      this.heap[index] = smallest;
      this.heap[smallestIndex] = current;
      this.timerIndexMap.set(smallest.id, index);
      this.timerIndexMap.set(current.id, smallestIndex);

      index = smallestIndex;
    }
  }
}

/**
 * Default singleton instance
 */
export const timerWheel = new TimerWheel();
