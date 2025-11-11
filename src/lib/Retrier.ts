import { timerWheel } from "./TimerWheel";

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

  constructor(options: RetrierOptions = {}) {
    this.options = {
      retry: options.retry ?? true,
      retryDelay: options.retryDelay ?? 0,
    };
  }

  /**
   * Execute a function with retry logic
   *
   * @param fn - The async function to execute
   * @returns Promise that resolves with the function result or rejects after all retries
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let failureCount = 0;

    while (true) {
      try {
        return await fn();
      } catch (error) {
        // Check if we should retry
        if (!this.shouldRetry(failureCount, error)) {
          throw error;
        }

        // Get delay before next retry
        const delay = this.getRetryDelay(failureCount, error);
        if (delay > 0) {
          await this.sleep(delay);
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
   * Sleep for the specified duration
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => timerWheel.schedule(resolve, ms));
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
}
