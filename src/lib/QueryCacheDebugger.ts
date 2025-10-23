import type { PromiseEntry } from "./PromiseEntry";

/**
 * Options for configuring the debugger
 */
export interface QueryCacheDebuggerOptions {
  /** Whether debugging is enabled */
  enabled?: boolean;
  /** Custom prefix for log messages */
  prefix?: string;
  /** Whether to log timestamps */
  showTimestamps?: boolean;
  /** Whether to log full data or just summaries */
  verboseData?: boolean;
}

/**
 * Debug event types
 */
type DebugEventType = "add" | "update" | "delete" | "status_change";

/**
 * Debug event data
 */
interface DebugEvent {
  type: DebugEventType;
  key: Array<unknown>;
  promiseEntry?: PromiseEntry<unknown>;
  reason?: string;
}

/**
 * QueryCacheDebugger provides debugging and logging capabilities for QueryCache
 *
 * Features:
 * - Logs promise additions, updates, and deletions
 * - Tracks promise status changes
 * - Groups related logs for better readability
 * - Supports verbose and summary modes
 *
 * @example
 * ```tsx
 * const debugger = new QueryCacheDebugger({ enabled: true })
 *
 * debugger.logAdd(['user', 1], promiseEntry)
 * debugger.logStatusChange(['user', 1], promiseEntry, 'pending', 'fulfilled')
 * debugger.logDelete(['user', 1], 'invalidated')
 * ```
 */
export class QueryCacheDebugger {
  private options: Required<QueryCacheDebuggerOptions>;
  private mainGroupOpen: boolean = false;

  constructor(options: QueryCacheDebuggerOptions = {}) {
    this.options = {
      enabled: options.enabled ?? false,
      prefix: options.prefix ?? "[QueryCache]",
      showTimestamps: options.showTimestamps ?? true,
      verboseData: options.verboseData ?? false,
    };
  }

  /**
   * Ensure the main debug group is open
   */
  private ensureGroupOpen(): void {
    if (!this.mainGroupOpen) {
      console.group(`${this.options.prefix} Debug Log`);
      this.mainGroupOpen = true;
    }
  }

  /**
   * Close the main debug group
   */
  private closeGroup(): void {
    if (this.mainGroupOpen) {
      console.groupEnd();
      this.mainGroupOpen = false;
    }
  }

  /**
   * Check if debugging is enabled
   */
  isEnabled(): boolean {
    return this.options.enabled;
  }

  /**
   * Enable or disable debugging
   */
  setEnabled(enabled: boolean): void {
    if (!enabled && this.mainGroupOpen) {
      this.closeGroup();
    }
    this.options.enabled = enabled;
    if (enabled) {
      this.ensureGroupOpen();
    }
  }

  /**
   * Log a promise addition to the cache
   */
  logAdd<T>(key: Array<unknown>, promiseEntry: PromiseEntry<T>): void {
    if (!this.options.enabled) {
      return;
    }

    const event: DebugEvent = {
      type: "add",
      key,
      promiseEntry: promiseEntry as PromiseEntry<unknown>,
    };

    this.logEvent(event);
  }

  /**
   * Log a promise update in the cache
   */
  logUpdate<T>(key: Array<unknown>, promiseEntry: PromiseEntry<T>): void {
    if (!this.options.enabled) {
      return;
    }

    const event: DebugEvent = {
      type: "update",
      key,
      promiseEntry: promiseEntry as PromiseEntry<unknown>,
    };

    this.logEvent(event);
  }

  /**
   * Log a promise deletion from the cache
   */
  logDelete(key: Array<unknown>, reason?: string): void {
    if (!this.options.enabled) {
      return;
    }

    const event: DebugEvent = {
      type: "delete",
      key,
      reason,
    };

    this.logEvent(event);
  }

  /**
   * Log a promise status change
   */
  logStatusChange<T>(
    key: Array<unknown>,
    promiseEntry: PromiseEntry<T>,
    oldStatus: string,
    newStatus: string
  ): void {
    if (!this.options.enabled) {
      return;
    }

    this.ensureGroupOpen();

    const timestamp = this.getTimestamp();
    const icon = "📊";
    const color = this.getEventColor("status_change");

    console.log(
      `%c${timestamp}${icon} Status Change: ${this.formatKey(key)}`,
      `color: ${color}; font-weight: bold`
    );

    console.log(
      `  %c${oldStatus} → ${newStatus}`,
      this.getStatusStyle(newStatus)
    );

    console.log(
      `  Timestamp: ${new Date(promiseEntry.timestamp).toISOString()}`
    );

    if (newStatus === "fulfilled" && promiseEntry.data != null) {
      console.log("  Data:", this.formatData(promiseEntry.data));
    }

    if (newStatus === "rejected" && promiseEntry.error != null) {
      console.error("  Error:", promiseEntry.error);
    }
  }

  /**
   * Log a cache snapshot (all entries)
   */
  logSnapshot(cache: Map<string, unknown>): void {
    if (!this.options.enabled) {
      return;
    }

    this.ensureGroupOpen();

    const timestamp = this.getTimestamp();
    console.log(
      `%c${timestamp}📸 Cache Snapshot`,
      "color: #9c27b0; font-weight: bold"
    );
    console.log(`  Total entries: ${cache.size}`);

    if (cache.size > 0) {
      const entries: Array<{ key: string; entry: unknown }> = [];
      for (const [key, entry] of cache.entries()) {
        entries.push({ key, entry });
      }
      console.table(
        entries.map((e) => ({
          key: e.key,
          entry: this.formatCacheEntry(e.entry),
        }))
      );
    }
  }

  /**
   * Log an event with appropriate formatting
   */
  private logEvent(event: DebugEvent): void {
    this.ensureGroupOpen();

    const icon = this.getEventIcon(event.type);
    const color = this.getEventColor(event.type);
    const timestamp = this.getTimestamp();

    console.log(
      `%c${timestamp}${icon} ${this.formatEventType(
        event.type
      )}: ${this.formatKey(event.key)}`,
      `color: ${color}; font-weight: bold`
    );

    if (event.promiseEntry != null) {
      this.logPromiseEntry(event.promiseEntry);
    }

    if (event.reason != null) {
      console.log(`  %cReason: ${event.reason}`, `color: ${color}`);
    }
  }

  /**
   * Log promise entry details
   */
  private logPromiseEntry(promiseEntry: PromiseEntry<unknown>): void {
    const statusStyle = this.getStatusStyle(promiseEntry.status);

    console.log(`  %cStatus: ${promiseEntry.status}`, statusStyle);
    console.log(
      `  Timestamp: ${new Date(promiseEntry.timestamp).toISOString()}`
    );

    if (promiseEntry.gcTime != null) {
      console.log(`  GC Time: ${promiseEntry.gcTime}ms`);
    }

    if (promiseEntry.status === "fulfilled" && promiseEntry.data != null) {
      console.log("  Data:", this.formatData(promiseEntry.data));
    }

    if (promiseEntry.status === "rejected" && promiseEntry.error != null) {
      console.error("  Error:", promiseEntry.error);
    }

    if (promiseEntry.metadata != null) {
      console.log("  Metadata:", promiseEntry.metadata);
    }
  }

  /**
   * Format data for display
   */
  private formatData(data: unknown): unknown {
    if (!this.options.verboseData) {
      if (typeof data === "object" && data != null) {
        if (Array.isArray(data)) {
          return `Array(${data.length})`;
        } else {
          return `Object(${Object.keys(data).length} keys)`;
        }
      }
    }
    return data;
  }

  /**
   * Format cache entry for display
   */
  private formatCacheEntry(entry: unknown): string {
    if (entry != null && typeof entry === "object") {
      const e = entry as {
        promise?: PromiseEntry<unknown>;
        subscriptions?: number;
        gcTime?: number;
      };
      if (e.promise != null) {
        return `${e.promise.status} (subs: ${e.subscriptions ?? 0})`;
      }
    }
    return String(entry);
  }

  /**
   * Format key for display
   */
  private formatKey(key: Array<unknown>): string {
    return JSON.stringify(key);
  }

  /**
   * Format event type for display
   */
  private formatEventType(type: DebugEventType): string {
    const typeMap: Record<DebugEventType, string> = {
      add: "Added",
      update: "Updated",
      delete: "Deleted",
      status_change: "Status Changed",
    };
    return typeMap[type];
  }

  /**
   * Get icon for event type
   */
  private getEventIcon(type: DebugEventType): string {
    const iconMap: Record<DebugEventType, string> = {
      add: "➕",
      update: "🔄",
      delete: "❌",
      status_change: "📊",
    };
    return iconMap[type];
  }

  /**
   * Get color for event type
   */
  private getEventColor(type: DebugEventType): string {
    const colorMap: Record<DebugEventType, string> = {
      add: "#4caf50",
      update: "#2196f3",
      delete: "#f44336",
      status_change: "#ff9800",
    };
    return colorMap[type];
  }

  /**
   * Get style for status
   */
  private getStatusStyle(status: string): string {
    const styleMap: Record<string, string> = {
      pending: "color: #ff9800; font-weight: bold",
      fulfilled: "color: #4caf50; font-weight: bold",
      rejected: "color: #f44336; font-weight: bold",
    };
    return styleMap[status] ?? "color: #666";
  }

  /**
   * Get timestamp string
   */
  private getTimestamp(): string {
    if (!this.options.showTimestamps) {
      return "";
    }
    const now = new Date();
    const time = now.toTimeString().split(" ")[0];
    const ms = now.getMilliseconds().toString().padStart(3, "0");
    return `[${time}.${ms}] `;
  }
}
