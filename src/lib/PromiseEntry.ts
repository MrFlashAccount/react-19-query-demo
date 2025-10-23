/**
 * Promise entry that extends Promise with additional tracking fields
 */
export interface PromiseEntry<PromiseValue extends unknown> {
  /** Function that returns the promise */
  (): Promise<PromiseValue>;
  /** The resolved data when promise is fulfilled */
  data?: PromiseValue;
  /** The error when promise is rejected */
  error?: unknown;
  /** Current status of the promise */
  status: "pending" | "fulfilled" | "rejected";
  /** Whether the promise is currently pending */
  isPending: boolean;
  /** Whether the promise is fulfilled */
  isFulfilled: boolean;
  /** Whether the promise is rejected */
  isRejected: boolean;
  /** Timestamp when the promise was created */
  timestamp: number;
  /** Garbage collection time in milliseconds */
  gcTime?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Factory class for creating PromiseEntry instances
 */
export class PromiseEntryFactory {
  /**
   * Create a PromiseEntry function that returns a promise and has tracking fields
   *
   * @param promise - The promise to wrap
   * @param gcTime - Optional garbage collection time
   * @param key - The cache key for debugging
   * @param onStatusChange - Optional callback for status changes
   * @returns A PromiseEntry function with status tracking
   */
  static create<PromiseValue extends unknown>(
    promise: Promise<PromiseValue>,
    options?: {
      gcTime?: number;
      key?: Array<unknown>;
      onStatusChange?: (
        oldStatus: string,
        newStatus: string,
        promiseEntry: PromiseEntry<PromiseValue>
      ) => void;
    }
  ): PromiseEntry<PromiseValue> {
    // Create a function that returns the promise
    const promiseEntry = (() => promise) as PromiseEntry<PromiseValue>;

    // Add tracking fields to the function
    promiseEntry.status = "pending";
    promiseEntry.isPending = true;
    promiseEntry.isFulfilled = false;
    promiseEntry.isRejected = false;
    promiseEntry.timestamp = Date.now();
    promiseEntry.gcTime = options?.gcTime;

    // Track state changes by chaining handlers
    promise.then(
      (data) => {
        const oldStatus = promiseEntry.status;
        promiseEntry.status = "fulfilled";
        promiseEntry.isPending = false;
        promiseEntry.isFulfilled = true;
        promiseEntry.data = data;

        if (options?.onStatusChange != null) {
          options.onStatusChange(oldStatus, "fulfilled", promiseEntry);
        }

        return data;
      },
      (error) => {
        const oldStatus = promiseEntry.status;
        promiseEntry.status = "rejected";
        promiseEntry.isPending = false;
        promiseEntry.isRejected = true;
        promiseEntry.error = error;

        if (options?.onStatusChange != null) {
          options.onStatusChange(oldStatus, "rejected", promiseEntry);
        }

        throw error;
      }
    );

    return promiseEntry;
  }
}
