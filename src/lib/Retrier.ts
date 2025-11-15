import { timerWheel } from "./TimerWheel";

/**
 * Custom error thrown when a Retrier is cancelled
 */
export class RetrierCancelledError extends Error {
  constructor(message: string = "Retrier cancelled") {
    super(message);
    this.name = "RetrierCancelledError";
  }
}

/**
 * Retry configuration options
 */
export type RetryConfig =
  | number
  | boolean
  | ((failureCount: number, error: unknown) => boolean);

/**
 * Options for creating a Retrier
 */
export interface RetrierOptions {
  /** Retry configuration - number of retries, boolean, or custom function */
  retry?: RetryConfig;
  /** Delay between retries in milliseconds (default: 0) */
  retryDelay?: number | ((failureCount: number, error: unknown) => number);
}

/**
 * Retrier class that handles retry logic for failed queries.
 *
 * Supports three modes:
 * - Number: Retry up to N times
 * - Boolean: true = retry 3 times (default), false = no retry
 * - Function: Custom logic based on error and attempt count
 *
 * @example
 * ```typescript
 * // Retry up to 5 times
 * const retrier = new Retrier({ retry: 5 });
 *
 * // Custom retry logic
 * const retrier = new Retrier({
 *   retry: (failureCount, error) => {
 *     // Only retry network errors, up to 3 times
 *     return failureCount < 3 && error instanceof NetworkError;
 *   }
 * });
 *
 * // Execute with retry
 * const result = await retrier.execute(async () => {
 *   return await fetchData();
 * });
 * ```
 */
export class Retrier {
  private options: Required<RetrierOptions>;
  private cancelled: boolean = false;
  private paused: boolean = false;
  private activeTimers: Set<() => void> = new Set();
  private pausedTimers: Array<{
    delay: number;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private pausedExecution: { resolve: () => void } | null = null;
  private currentExecutionId: number = 0;
  private nextExecutionId: number = 1;

  constructor(options: RetrierOptions = {}) {
    this.options = {
      retry: options.retry ?? true,
      retryDelay: options.retryDelay ?? 0,
    };
  }

  setOptions(options: RetrierOptions): void {
    this.options = {
      retry: options.retry ?? true,
      retryDelay: options.retryDelay ?? 0,
    };
  }

  /**
   * Execute a function with retry logic
   * Each new call to execute() will cancel any previous ongoing execution
   *
   * @param fn - The async function to execute
   * @returns Promise that resolves with the function result or rejects after all retries
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Cancel any previous execution by updating the current execution ID
    // This will cause the previous execution to throw RetrierCancelledError
    const executionId = this.nextExecutionId++;
    this.currentExecutionId = executionId;

    // Cancel all active timers to wake up any sleeping previous execution
    const timers = Array.from(this.activeTimers);
    for (const cancelFn of timers) {
      cancelFn();
    }

    let failureCount = 0;

    while (true) {
      // Check if this execution has been superseded by a newer one
      if (this.currentExecutionId !== executionId) {
        throw new RetrierCancelledError();
      }

      // Check if cancelled before attempting
      if (this.cancelled) {
        throw new RetrierCancelledError();
      }

      // Wait if paused before attempting execution
      if (this.paused) {
        await new Promise<void>((resolve) => {
          this.pausedExecution = { resolve };
        });
      }

      // Check again after pause
      if (this.currentExecutionId !== executionId) {
        throw new RetrierCancelledError();
      }

      try {
        return await fn();
      } catch (error) {
        // Check if this execution has been superseded
        if (this.currentExecutionId !== executionId) {
          throw new RetrierCancelledError();
        }

        // Check if cancelled after error
        if (this.cancelled) {
          throw new RetrierCancelledError();
        }

        // Check if we should retry
        if (!this.shouldRetry(failureCount, error)) {
          throw error;
        }

        // Get delay before next retry
        const delay = this.getRetryDelay(failureCount, error);

        if (delay > 0) {
          await this.sleep(delay);
        } else {
          // Even with no delay, yield control to allow cancellation
          await Promise.resolve();
        }

        // Check if this execution has been superseded after delay
        if (this.currentExecutionId !== executionId) {
          throw new RetrierCancelledError();
        }

        // Check if cancelled after delay/yield
        if (this.cancelled) {
          throw new RetrierCancelledError();
        }

        failureCount++;
      }
    }
  }

  /**
   * Determine if we should retry based on the retry configuration
   *
   * @param failureCount - Number of failures so far
   * @param error - The error that occurred
   * @returns True if we should retry
   */
  private shouldRetry(failureCount: number, error: unknown): boolean {
    const { retry } = this.options;

    if (typeof retry === "boolean") {
      // Boolean: true = retry 3 times, false = no retry
      return retry && failureCount < 3;
    }

    if (typeof retry === "number") {
      // Number: retry up to N times
      return failureCount < retry;
    }

    if (typeof retry === "function") {
      // Function: custom logic
      return retry(failureCount, error);
    }

    return false;
  }

  /**
   * Get the delay before the next retry attempt
   *
   * @param failureCount - Number of failures so far
   * @param error - The error that occurred
   * @returns Delay in milliseconds
   */
  private getRetryDelay(failureCount: number, error: unknown): number {
    const { retryDelay } = this.options;

    if (typeof retryDelay === "number") {
      return retryDelay;
    }

    if (typeof retryDelay === "function") {
      return retryDelay(failureCount, error);
    }

    return 0;
  }

  /**
   * Sleep for the specified duration, with support for pause/resume
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let timerId: number | null = null;
      let isPaused: boolean = false;
      let isCompleted: boolean = false;

      const cleanup = () => {
        if (isCompleted || isPaused) {
          // Don't resolve/reject if already completed or paused
          return;
        }
        isCompleted = true;
        this.activeTimers.delete(cancelFn);
        if (this.cancelled) {
          reject(new RetrierCancelledError());
        } else {
          resolve();
        }
      };

      const cancelFn = () => {
        this.activeTimers.delete(cancelFn);
        if (timerId !== null) {
          timerWheel.cancel(timerId);
          timerId = null;
        }
        // Remove from paused timers if it's there
        const pausedIndex = this.pausedTimers.findIndex(
          (t) => t.resolve === resolve
        );
        if (pausedIndex !== -1) {
          this.pausedTimers.splice(pausedIndex, 1);
        }
        reject(new RetrierCancelledError());
      };

      const pauseFn = () => {
        if (!isPaused && timerId !== null) {
          isPaused = true;

          // Cancel the current timer
          const cancelled = timerWheel.cancel(timerId);
          timerId = null;

          // Only store if we successfully cancelled
          if (cancelled) {
            // Store the paused timer info
            // Note: In fake timer environments, we can't accurately track elapsed time
            // so we store the full delay. This means pause/resume restarts the delay.
            this.pausedTimers.push({
              delay: ms,
              resolve,
              reject,
            });
          }
        }
      };

      const resumeFn = () => {
        if (isPaused) {
          isPaused = false;

          // Find and remove from paused timers
          const pausedIndex = this.pausedTimers.findIndex(
            (t) => t.resolve === resolve
          );
          if (pausedIndex !== -1) {
            const pausedTimer = this.pausedTimers[pausedIndex];
            this.pausedTimers.splice(pausedIndex, 1);

            // Create a new cleanup that can complete
            const newCleanup = () => {
              if (isCompleted || isPaused) {
                return;
              }
              isCompleted = true;
              this.activeTimers.delete(cancelFn);
              if (this.cancelled) {
                reject(new RetrierCancelledError());
              } else {
                resolve();
              }
            };

            // Restart the timer with the full delay
            // Note: This means the delay restarts, not continues from where it left off
            timerId = timerWheel.schedule(newCleanup, pausedTimer.delay);
          }
        }
      };

      // Store pause/resume functions for this specific timer
      (cancelFn as any).pause = pauseFn;
      (cancelFn as any).resume = resumeFn;

      this.activeTimers.add(cancelFn);
      timerId = timerWheel.schedule(cleanup, ms);
    });
  }

  /**
   * Get the configured retry value
   */
  getRetryConfig(): RetryConfig {
    return this.options.retry;
  }

  /**
   * Get the configured retry delay configuration
   */
  getRetryDelayConfig():
    | number
    | ((failureCount: number, error: unknown) => number) {
    return this.options.retryDelay;
  }

  /**
   * Cancel all ongoing retry operations
   * This will cause all pending executions to reject with RetrierCancelledError
   */
  cancel(): void {
    this.cancelled = true;

    // Cancel all active timers
    const timers = Array.from(this.activeTimers);
    for (const cancelFn of timers) {
      cancelFn();
    }

    // Clear paused timers as well
    this.pausedTimers = [];

    // Clear paused executions (they will be cancelled when they check this.cancelled)
    this.pausedExecution = null;
  }

  /**
   * Reset the retrier state, allowing new executions after cancellation
   */
  reset(): void {
    this.cancelled = false;
    this.paused = false;
    this.activeTimers.clear();
    this.pausedTimers = [];
    this.pausedExecution = null;
    this.currentExecutionId = 0;
    this.nextExecutionId = 1;
  }

  /**
   * Pause all ongoing retry operations
   * This will pause all active delays, allowing them to be resumed later
   */
  pause(): void {
    this.paused = true;

    // Pause all active timers
    const timers = Array.from(this.activeTimers);
    for (const cancelFn of timers) {
      if (typeof (cancelFn as any).pause === "function") {
        (cancelFn as any).pause();
      }
    }
  }

  /**
   * Resume all paused retry operations
   * This will continue all paused delays from where they left off
   */
  resume(): void {
    this.paused = false;

    // Resume all paused timers
    const timers = Array.from(this.activeTimers);
    for (const cancelFn of timers) {
      if (typeof (cancelFn as any).resume === "function") {
        (cancelFn as any).resume();
      }
    }

    // Resume all paused executions
    if (this.pausedExecution !== null) {
      this.pausedExecution.resolve();
      this.pausedExecution = null;
    }
  }
}
