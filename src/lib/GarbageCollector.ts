import type { PromiseEntry } from "./PromiseEntry";

/**
 * Cache entry with promise and garbage collection metadata
 */
export interface CacheEntry {
  promise: PromiseEntry<unknown>;
  /** Number of active subscriptions to this cache entry */
  subscriptions: number;
  /** GC time in milliseconds */
  gcTime?: number;
  /** Timestamp when entry became eligible for GC (when subscriptions reached 0) */
  gcEligibleAt?: number;
  /** Stale time in milliseconds, 'static', or Infinity */
  staleTime?: number | "static";
  /** Timestamp when the data was last fetched successfully */
  dataUpdatedAt?: number;
}

/**
 * Options for GarbageCollector
 */
export interface GarbageCollectorOptions {
  /** Interval in milliseconds to check for expired entries. Default: 100ms */
  checkInterval?: number;
  /** Callback when an entry is garbage collected */
  onCollect?: (key: string) => void;
}

/**
 * GarbageCollector manages automatic cleanup of cache entries
 *
 * Features:
 * - Runs checks every 100ms (configurable)
 * - Uses requestIdleCallback for non-blocking GC
 * - Only collects entries with no active subscriptions
 * - Respects gcTime and gcEligibleAt timestamps
 *
 * @example
 * ```typescript
 * const gc = new GarbageCollector({
 *   checkInterval: 100,
 *   onCollect: (key) => console.log('Collected:', key)
 * });
 *
 * gc.start(cacheMap);
 * // ... later
 * gc.stop();
 * ```
 */
export class GarbageCollector {
  private options: Required<GarbageCollectorOptions>;
  private schedulerIntervalId?: ReturnType<typeof setInterval>;
  private schedulerRunning: boolean = false;
  private cache?: Map<string, CacheEntry>;

  constructor(options: GarbageCollectorOptions = {}) {
    this.options = {
      checkInterval: options.checkInterval ?? 100,
      onCollect: options.onCollect ?? (() => {}),
    };
  }

  /**
   * Start the garbage collection scheduler
   *
   * @param cache - The cache map to monitor
   */
  start(cache: Map<string, CacheEntry>): void {
    if (this.schedulerIntervalId != null) {
      return;
    }

    this.cache = cache;

    this.schedulerIntervalId = setInterval(() => {
      this.scheduleGarbageCollection();
    }, this.options.checkInterval);
  }

  /**
   * Stop the garbage collection scheduler
   */
  stop(): void {
    if (this.schedulerIntervalId != null) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = undefined;
    }
    this.cache = undefined;
  }

  /**
   * Check if the scheduler is running
   */
  isRunning(): boolean {
    return this.schedulerIntervalId != null;
  }

  /**
   * Schedule garbage collection to run during idle time
   */
  private scheduleGarbageCollection(): void {
    if (this.schedulerRunning || this.cache == null) {
      return;
    }

    this.schedulerRunning = true;

    if (
      typeof requestIdleCallback !== "undefined" &&
      typeof window !== "undefined"
    ) {
      requestIdleCallback(() => {
        this.runGarbageCollection();
        this.schedulerRunning = false;
      });
    } else {
      // Fallback for environments without requestIdleCallback (like tests)
      setTimeout(() => {
        this.runGarbageCollection();
        this.schedulerRunning = false;
      }, 0);
    }
  }

  /**
   * Run garbage collection by checking all cache entries
   * and removing those that have expired
   */
  private runGarbageCollection(): void {
    if (this.cache == null) {
      return;
    }

    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.shouldGarbageCollect(entry, now)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.options.onCollect(key);
      this.cache.delete(key);
    }
  }

  /**
   * Check if a cache entry should be garbage collected
   *
   * @param entry - The cache entry to check
   * @param now - Current timestamp
   * @returns True if the entry should be removed
   */
  private shouldGarbageCollect(entry: CacheEntry, now: number): boolean {
    if (entry.subscriptions > 0) {
      return false;
    }

    if (entry.gcTime == null || entry.gcTime === Infinity) {
      return false;
    }

    if (entry.gcEligibleAt == null) {
      return false;
    }

    return now >= entry.gcEligibleAt + entry.gcTime;
  }

  /**
   * Manually trigger garbage collection (useful for testing)
   * This bypasses the scheduler and immediately runs GC
   */
  triggerCollection(): void {
    if (this.cache != null) {
      this.runGarbageCollection();
    }
  }

  /**
   * Mark an entry as eligible for garbage collection
   *
   * @param key - The cache key
   */
  markEligible(key: string): void {
    if (this.cache == null) {
      return;
    }

    const entry = this.cache.get(key);
    if (entry != null && entry.subscriptions === 0) {
      entry.gcEligibleAt = Date.now();
    }
  }

  /**
   * Clear the eligibility timestamp for an entry
   *
   * @param key - The cache key
   */
  clearEligibility(key: string): void {
    if (this.cache == null) {
      return;
    }

    const entry = this.cache.get(key);
    if (entry != null) {
      entry.gcEligibleAt = undefined;
    }
  }
}
