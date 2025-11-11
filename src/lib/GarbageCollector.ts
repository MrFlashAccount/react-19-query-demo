import type { PromiseEntry } from "./PromiseEntry";
import { timerWheel } from "./TimerWheel";

export interface IGarbageCollectable {
  gcTime?: number;
  isEligibleForGC(): boolean;
  markEligibleForGC(): void;
  canBeCollected(): boolean;
  remove(): boolean;
}

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
  /** Callback when an entry is garbage collected */
  onCollect?: (entry: IGarbageCollectable) => void;
  onCollectBatch?: (entries: IGarbageCollectable[]) => void;
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
  private timerIdPerEntry = new Map<IGarbageCollectable, number>();
  private collectableEntries = new Set<IGarbageCollectable>();

  constructor(options: GarbageCollectorOptions = {}) {
    this.options = {
      onCollect: options.onCollect ?? (() => {}),
      onCollectBatch: options.onCollectBatch ?? (() => {}),
    };
  }

  add(entry: IGarbageCollectable): void {
    const timerId = timerWheel.schedule(() => {
      const isCollected = this.tryCollect(entry);

      if (isCollected) {
        this.options.onCollect(entry);
      }

      this.timerIdPerEntry.delete(entry);
    }, entry.gcTime ?? Infinity);

    if (timerId == null) {
      return;
    }

    this.timerIdPerEntry.set(entry, timerId);
    this.collectableEntries.add(entry);
  }

  remove(entry: IGarbageCollectable): void {
    const timerId = this.timerIdPerEntry.get(entry);

    if (timerId == null) {
      return;
    }
    if (!timerWheel.cancel(timerId)) {
      return;
    }

    this.timerIdPerEntry.delete(entry);
    this.collectableEntries.delete(entry);
  }

  forceCollect(): void {
    for (const entry of this.collectableEntries.values()) {
      this.tryCollect(entry);
    }
  }

  private tryCollect(entry: IGarbageCollectable): boolean {
    if (!this.shouldGarbageCollect(entry)) {
      return false;
    }

    const isCollected = entry.remove();

    if (isCollected) {
      this.collectableEntries.delete(entry);
      this.timerIdPerEntry.delete(entry);
    }

    return isCollected;
  }

  /**
   * Check if a cache entry should be garbage collected
   *
   * @param entry - The cache entry to check
   * @param now - Current timestamp
   * @returns True if the entry should be removed
   */
  private shouldGarbageCollect(entry: IGarbageCollectable): boolean {
    if (!entry.isEligibleForGC()) {
      return false;
    }

    return entry.canBeCollected();
  }
}
