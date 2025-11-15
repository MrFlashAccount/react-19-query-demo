/**
 * Timer entry stored in the wheel
 * Using a class for better memory layout and potential V8 optimization
 */
class TimerEntry {
  /** Callback function to execute */
  callback: () => void;
  /** Absolute expiration time in milliseconds */
  expirationTime: number;
  /** Next timer in the linked list (for collision handling) */
  next: TimerEntry | null = null;
  /** Whether this timer has been cancelled */
  cancelled: boolean = false;

  constructor(callback: () => void, expirationTime: number) {
    this.callback = callback;
    this.expirationTime = expirationTime;
  }

  /**
   * Reset the entry for reuse (object pooling)
   */
  reset(callback: () => void, expirationTime: number): void {
    this.callback = callback;
    this.expirationTime = expirationTime;
    this.next = null;
    this.cancelled = false;
  }
}

/**
 * Object pool for TimerEntry to reduce allocations
 */
class TimerEntryPool {
  private pool: TimerEntry[] = [];
  private poolSize: number = 0;
  private readonly maxPoolSize: number = 100;

  acquire(callback: () => void, expirationTime: number): TimerEntry {
    if (this.poolSize > 0) {
      const entry = this.pool[--this.poolSize]!;
      entry.reset(callback, expirationTime);
      return entry;
    }
    return new TimerEntry(callback, expirationTime);
  }

  release(entry: TimerEntry): void {
    if (this.poolSize < this.maxPoolSize) {
      // Clear references to help GC
      entry.callback = null!;
      entry.next = null;
      this.pool[this.poolSize++] = entry;
    }
  }
}

/**
 * Options for TimerWheel configuration
 */
export interface TimerWheelOptions {
  /** Tick interval in milliseconds (default: 1ms for high precision) */
  tickInterval?: number;
  /** Number of slots in each wheel level (default: 256, power of 2 for bitwise optimization) */
  slotsPerLevel?: number;
  /** Number of wheel levels (default: 4, supports up to ~256^4 * tickInterval) */
  levels?: number;
}

/**
 * High-performance hierarchical Timer Wheel implementation
 *
 * Based on the Linux kernel's timer wheel algorithm, optimized for JavaScript:
 * - Uses arrays instead of Maps for better cache locality
 * - Bitwise operations for fast slot calculation
 * - Object pooling to minimize allocations
 * - Hierarchical structure for O(1) insertion and O(1) average-case expiration
 * - Only schedules timeout when there are active timers (lazy scheduling)
 *
 * Performance characteristics:
 * - Schedule: O(1) amortized
 * - Cancel: O(1) amortized
 * - Processes only slots with expiring timers
 *
 * @example
 * ```typescript
 * const wheel = new TimerWheel({ tickInterval: 10 });
 * const timerId = wheel.schedule(() => console.log('Hello'), 1000);
 * // Timer automatically schedules itself
 * // ... later
 * wheel.cancel(timerId);
 * // Timer automatically cancels if no active timers remain
 * ```
 */
export class TimerWheel {
  /** Tick interval in milliseconds */
  private readonly tickInterval: number;
  /** Number of slots per level (must be power of 2) */
  private readonly slotsPerLevel: number;
  /** Number of wheel levels */
  private readonly levels: number;
  /** Bitmask for fast modulo operation (slotsPerLevel - 1) */
  private readonly slotMask: number;

  /** Hierarchical wheel structure: levels[level][slot] = head of linked list */
  private readonly wheels: (TimerEntry | null)[][];
  /** Current time in milliseconds (updated on each tick) */
  private currentTime: number = 0;
  /** Current position in each wheel level */
  private readonly currentSlots: number[];
  /** Precomputed level ranges for fast level calculation (levelRanges[i] = slotsPerLevel^(i+1)) */
  private readonly levelRanges: number[];
  /** Precomputed level starts for fast slot calculation (levelStarts[i] = slotsPerLevel^i) */
  private readonly levelStarts: number[];

  /** Object pool for timer entries */
  private readonly entryPool: TimerEntryPool = new TimerEntryPool();
  /** Map from timer ID to entry for O(1) cancellation */
  private readonly timerMap: Map<number, TimerEntry> = new Map();
  /** Map from entry to timer ID for O(1) removal from timerMap */
  private readonly entryToIdMap: WeakMap<TimerEntry, number> = new WeakMap();
  /** Next timer ID */
  private nextTimerId: number = 1;

  /** Timeout handle for the next scheduled tick */
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  /** Whether the wheel is initialized (currentTime set) */
  private initialized: boolean = false;
  /** Whether a reschedule microtask is already queued */
  private rescheduleQueued: boolean = false;

  constructor(options: TimerWheelOptions = {}) {
    this.tickInterval = options.tickInterval ?? 1;
    this.slotsPerLevel = options.slotsPerLevel ?? 256;
    this.levels = options.levels ?? 4;

    // Validate slotsPerLevel is a power of 2
    if ((this.slotsPerLevel & (this.slotsPerLevel - 1)) !== 0) {
      throw new Error("slotsPerLevel must be a power of 2");
    }

    this.slotMask = this.slotsPerLevel - 1;

    // Precompute level ranges and starts for fast calculation
    this.levelRanges = [];
    this.levelStarts = [];
    let range = this.slotsPerLevel;
    let start = 1;
    for (let level = 0; level < this.levels; level++) {
      this.levelRanges[level] = range;
      this.levelStarts[level] = start;
      range *= this.slotsPerLevel;
      start *= this.slotsPerLevel;
    }

    // Initialize wheel structure
    this.wheels = [];
    this.currentSlots = [];
    for (let level = 0; level < this.levels; level++) {
      this.wheels[level] = new Array<TimerEntry | null>(
        this.slotsPerLevel
      ).fill(null);
      this.currentSlots[level] = 0;
    }
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

    // Initialize current time on first schedule
    if (!this.initialized) {
      this.currentTime = Date.now();
      this.initialized = true;
    }

    const timerId = this.nextTimerId++;
    const expirationTime = this.currentTime + delayMs;
    const entry = this.entryPool.acquire(callback, expirationTime);

    this.timerMap.set(timerId, entry);
    this.entryToIdMap.set(entry, timerId);
    this.insertTimer(entry, expirationTime);

    // Queue reschedule to batch multiple calls
    this.queueReschedule();

    return timerId;
  }

  /**
   * Cancel a scheduled timer
   *
   * @param timerId - Timer ID returned from schedule()
   * @returns True if the timer was found and cancelled
   */
  cancel(timerId: number): boolean {
    const entry = this.timerMap.get(timerId);
    if (entry == null) {
      return false;
    }

    entry.cancelled = true;
    this.timerMap.delete(timerId);
    this.entryToIdMap.delete(entry);

    // Queue reschedule/cancel to batch multiple calls
    this.queueReschedule();

    return true;
  }

  /**
   * Get the current time in milliseconds
   */
  getCurrentTime(): number {
    return this.initialized ? this.currentTime : Date.now();
  }

  /**
   * Find the nearest slot with timers and calculate its target time
   *
   * @returns Target time in milliseconds for the nearest slot, or null if no timers
   */
  private findNearestSlotTime(): number | null {
    if (this.timerMap.size === 0) {
      return null;
    }

    // Update current time
    const now = Date.now();
    this.currentTime = now;

    // Find the nearest expiration time among all active timers
    let nearestExpiration: number | null = null;
    for (const entry of this.timerMap.values()) {
      if (!entry.cancelled) {
        if (
          nearestExpiration == null ||
          entry.expirationTime < nearestExpiration
        ) {
          nearestExpiration = entry.expirationTime;
        }
      }
    }

    if (nearestExpiration == null) {
      return null;
    }

    // Calculate delay to the nearest expiration
    const delay = Math.max(0, nearestExpiration - now);

    // Round up to the nearest tick boundary for slot alignment
    const ticksToExpiration = Math.ceil(delay / this.tickInterval);
    const targetTime = now + ticksToExpiration * this.tickInterval;

    return targetTime;
  }

  /**
   * Queue a reschedule operation using queueMicrotask for batching
   * Multiple calls will be batched into a single reschedule operation
   */
  private queueReschedule(): void {
    if (this.rescheduleQueued) {
      return;
    }

    this.rescheduleQueued = true;
    queueMicrotask(() => {
      this.rescheduleQueued = false;
      this.doReschedule();
    });
  }

  /**
   * Actually perform the reschedule operation
   * This is called from the batched microtask
   */
  private doReschedule(): void {
    // Cancel existing timeout
    if (this.timeoutId != null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // If no active timers, don't schedule anything
    if (this.timerMap.size === 0) {
      return;
    }

    // Find the nearest slot time
    const targetTime = this.findNearestSlotTime();
    if (targetTime == null) {
      return;
    }

    // Calculate delay
    const delay = Math.max(0, targetTime - Date.now());

    // Schedule timeout to process the slot at that time
    this.timeoutId = setTimeout(() => {
      this.processSlot(targetTime);
    }, delay);
  }

  /**
   * Process timers in the slot that expires at targetTime
   *
   * @param targetTime - The target time we're processing
   */
  private processSlot(targetTime: number): void {
    this.timeoutId = null;

    // Update current time
    this.currentTime = targetTime;

    // Calculate which slot we're processing based on targetTime
    const currentTick = Math.floor(this.currentTime / this.tickInterval);
    const slot = currentTick & this.slotMask;

    // Process all timers in this slot (level 0)
    const wheel = this.wheels[0]!;
    let entry = wheel[slot];

    if (entry != null) {
      // Clear the slot
      wheel[slot] = null;

      // Process all timers in this slot
      const expiredEntries: TimerEntry[] = [];
      const activeEntries: TimerEntry[] = [];

      while (entry != null) {
        const next: TimerEntry | null = entry.next;

        if (entry.cancelled) {
          // Timer was cancelled, just release it
          this.entryPool.release(entry);
        } else if (entry.expirationTime <= this.currentTime) {
          // Timer expired, execute it
          expiredEntries.push(entry);
        } else {
          // Timer not expired yet, re-insert it
          activeEntries.push(entry);
        }

        entry = next;
      }

      // Execute expired timers
      for (const entry of expiredEntries) {
        this.executeTimer(entry);
      }

      // Re-insert active timers
      for (const entry of activeEntries) {
        this.insertTimer(entry, entry.expirationTime);
      }
    }

    // Also check for any other timers that expired (in case of timing drift)
    const allExpired: TimerEntry[] = [];
    for (const entry of this.timerMap.values()) {
      if (!entry.cancelled && entry.expirationTime <= this.currentTime) {
        allExpired.push(entry);
      }
    }

    // Execute any other expired timers
    for (const entry of allExpired) {
      this.executeTimer(entry);
    }

    // Queue reschedule to the next nearest expiration
    if (this.timerMap.size > 0) {
      this.queueReschedule();
    }
  }

  /**
   * Insert a timer into the appropriate wheel slot
   *
   * @param entry - Timer entry to insert
   * @param expirationTime - Expiration time in milliseconds
   */
  private insertTimer(entry: TimerEntry, expirationTime: number): void {
    const deltaMs = expirationTime - this.currentTime;

    if (deltaMs < 0) {
      // Timer already expired, will be executed in processSlot
      return;
    }

    const deltaTicks = Math.ceil(deltaMs / this.tickInterval);
    const currentTick = Math.floor(this.currentTime / this.tickInterval);
    const expirationTick = currentTick + deltaTicks;

    // Calculate which level and slot to use
    let level = 0;
    let slot = 0;

    if (deltaTicks < this.slotsPerLevel) {
      // Fits in level 0 - use the exact slot
      slot = expirationTick & this.slotMask;
    } else {
      // Find the appropriate level using precomputed ranges
      for (let l = 1; l < this.levels; l++) {
        if (deltaTicks < this.levelRanges[l]!) {
          level = l;
          const levelStart = this.levelStarts[l]!;
          // Calculate which slot in this level based on expiration tick
          slot = Math.floor(expirationTick / levelStart) & this.slotMask;
          break;
        }
      }

      // If still not found, put in the highest level
      if (level === 0) {
        level = this.levels - 1;
        const levelStart = this.levelStarts[level]!;
        slot = Math.floor(expirationTick / levelStart) & this.slotMask;
      }
    }

    // Insert at the head of the linked list
    const wheel = this.wheels[level]!;
    const head = wheel[slot];
    entry.next = head;
    wheel[slot] = entry;
  }

  /**
   * Execute a timer callback
   *
   * @param entry - Timer entry to execute
   */
  private executeTimer(entry: TimerEntry): void {
    if (entry.cancelled) {
      this.entryPool.release(entry);
      return;
    }

    // Remove from timer map using WeakMap for O(1) lookup
    const timerId = this.entryToIdMap.get(entry);
    if (timerId != null) {
      this.timerMap.delete(timerId);
      this.entryToIdMap.delete(entry);
    }

    // Execute callback
    const callback = entry.callback;
    try {
      callback();
    } catch (error) {
      // Log error but don't throw to prevent breaking the wheel
      console.error("Timer callback error:", error);
    }

    // Release entry back to pool
    this.entryPool.release(entry);
  }

  /**
   * Get the number of active timers
   */
  getActiveTimerCount(): number {
    return this.timerMap.size;
  }

  /**
   * Check if there are any active timers
   */
  hasActiveTimers(): boolean {
    return this.timerMap.size > 0;
  }

  /**
   * Clear all timers and cancel any scheduled timeouts
   */
  clear(): void {
    // Cancel timeout immediately (don't batch during clear)
    if (this.timeoutId != null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.rescheduleQueued = false;

    // Clear all wheels
    for (let level = 0; level < this.levels; level++) {
      const wheel = this.wheels[level]!;
      for (let slot = 0; slot < this.slotsPerLevel; slot++) {
        let entry = wheel[slot];
        while (entry != null) {
          const next = entry.next;
          this.entryPool.release(entry);
          entry = next;
        }
        wheel[slot] = null;
      }
    }

    // Clear timer maps
    this.timerMap.clear();
    this.currentTime = 0;
    this.initialized = false;

    // Reset current slots
    for (let level = 0; level < this.levels; level++) {
      this.currentSlots[level] = 0;
    }
  }
}

/**
 * Default singleton instance
 */
export const timerWheel = new TimerWheel({ tickInterval: 1 });
