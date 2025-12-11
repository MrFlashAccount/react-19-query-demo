import {
  tracer,
  type TraceEvent,
  type SpanStartEvent,
  type SpanEndEvent,
  type SpanEvent,
} from "../tracing";
import { StatusIcons, getDevtoolsColor } from "./constants";

/**
 * Internal metrics for an active span
 */
interface SpanMetrics {
  spanId: string;
  parentSpanId?: string;
  spanType: string;
  startMark: string;
  startTime: number;
  payload: Record<string, unknown>;
  events: Array<{
    name: string;
    timestamp: number;
    payload?: Record<string, unknown>;
  }>;
}

/**
 * Chrome DevTools performance panel detail structure
 */
interface DevtoolsDetail {
  color: string;
  trackGroup: string;
  track: string;
  properties?: Array<[string, string]>;
  tooltip?: string;
}

export interface MeasurerOptions {
  /**
   * Prefix for performance marks
   * @default "query-lib"
   */
  prefix?: string;
  /**
   * Whether to use User Timing API (performance.mark/measure)
   * @default true
   */
  useUserTiming?: boolean;
  /**
   * Custom track group name
   * @default "Query Library 🐐"
   */
  trackGroupName?: string;
  /**
   * Custom track name (all spans stack on this single track)
   * @default "Timeline"
   */
  trackName?: string;
}

/**
 * Measurer listens to trace events and creates performance measures
 * for visualization in Chrome DevTools Performance panel.
 *
 * Much simpler than the previous event-name-parsing approach!
 */
export class Measurer {
  private spans = new Map<string, SpanMetrics>();
  private unsubscribe?: () => void;
  private options: Required<MeasurerOptions>;

  constructor(options: MeasurerOptions = {}) {
    this.options = {
      prefix: options.prefix ?? "query-lib",
      useUserTiming: options.useUserTiming ?? true,
      trackGroupName: options.trackGroupName ?? "Query Library 🐐",
      trackName: options.trackName ?? "Timeline",
    };
  }

  /**
   * Start listening to trace events
   */
  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = tracer.subscribe((event) => this.handleEvent(event));
  }

  /**
   * Stop listening and clear all state
   */
  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.spans.clear();
  }

  /**
   * Alias for start()
   */
  enable(): void {
    this.start();
  }

  /**
   * Alias for stop()
   */
  disable(): void {
    this.stop();
  }

  /**
   * Clear all performance marks and measures created by this measurer
   */
  clearAll(): void {
    if (!this.options.useUserTiming) return;

    const marks = performance.getEntriesByType("mark");
    marks.forEach((entry) => {
      if (entry.name.startsWith(this.options.prefix)) {
        performance.clearMarks(entry.name);
      }
    });

    const measures = performance.getEntriesByType("measure");
    measures.forEach((measure) => {
      if (measure.name.startsWith(this.options.prefix)) {
        performance.clearMeasures(measure.name);
      }
    });
  }

  /**
   * Get current active spans (for debugging)
   */
  getActiveSpans(): SpanMetrics[] {
    return Array.from(this.spans.values());
  }

  // ============================================
  // EVENT HANDLING - No string parsing needed!
  // ============================================

  private handleEvent(event: TraceEvent): void {
    // Simple switch on discriminated union - no string parsing!
    switch (event.kind) {
      case "span:start":
        this.handleSpanStart(event);
        break;
      case "span:end":
        this.handleSpanEnd(event);
        break;
      case "span:event":
        this.handleSpanEvent(event);
        break;
    }
  }

  private handleSpanStart(event: SpanStartEvent): void {
    const markName = `${this.options.prefix}:${event.spanId}:start`;

    if (this.options.useUserTiming) {
      performance.mark(markName);
    }

    this.spans.set(event.spanId, {
      spanId: event.spanId,
      parentSpanId: event.parentSpanId,
      spanType: event.spanType,
      startMark: markName,
      startTime: event.timestamp,
      payload: event.payload,
      events: [],
    });
  }

  private handleSpanEnd(event: SpanEndEvent): void {
    const metrics = this.spans.get(event.spanId);
    if (!metrics) return;

    const endMark = `${this.options.prefix}:${event.spanId}:end`;

    if (this.options.useUserTiming) {
      performance.mark(endMark);

      try {
        const duration = event.timestamp - metrics.startTime;
        const [category, action] = metrics.spanType.split(":");
        const icon =
          event.status === "success" ? StatusIcons.success : StatusIcons.error;
        const label = this.formatLabel(category, action, metrics.payload);

        performance.measure(`${icon} ${label}`, {
          start: metrics.startMark,
          end: endMark,
          detail: {
            devtools: this.buildDevtoolsDetail(
              event.status,
              category,
              action,
              duration,
              metrics,
              event
            ),
          },
        });
      } catch (error) {
        console.warn("Failed to create performance measure:", error);
      }

      // Cleanup marks
      this.cleanupMarks(metrics.startMark, endMark);
    }

    this.spans.delete(event.spanId);
  }

  private handleSpanEvent(event: SpanEvent): void {
    const metrics = this.spans.get(event.spanId);
    if (!metrics) return;

    metrics.events.push({
      name: event.name,
      timestamp: event.timestamp,
      payload: event.payload,
    });
  }

  // ============================================
  // FORMATTING HELPERS
  // ============================================

  private buildDevtoolsDetail(
    status: "success" | "error",
    category: string,
    action: string,
    duration: number,
    metrics: SpanMetrics,
    endEvent: SpanEndEvent
  ): DevtoolsDetail {
    const properties: Array<[string, string]> = [
      ["Category", this.capitalize(category)],
      ["Action", this.capitalize(action)],
      ["Status", status],
      ["Duration", `${duration.toFixed(2)}ms`],
    ];

    // Add payload properties
    this.addPayloadProperties(properties, metrics.payload);

    // Add end event payload if present
    if (endEvent.payload) {
      this.addPayloadProperties(properties, endEvent.payload);
    }

    // Add error info if present
    if (endEvent.error) {
      properties.push(["Error", this.stringifyValue(endEvent.error)]);
    }

    // Add intermediate events count if any
    if (metrics.events.length > 0) {
      properties.push(["Events", String(metrics.events.length)]);
    }

    return {
      color: getDevtoolsColor(status, category),
      trackGroup: this.options.trackGroupName,
      track: this.options.trackName,
      properties,
      tooltip: this.formatLabel(category, action, metrics.payload),
    };
  }

  private addPayloadProperties(
    properties: Array<[string, string]>,
    payload: Record<string, unknown>
  ): void {
    for (const [key, value] of Object.entries(payload)) {
      // Skip internal properties
      if (key === "scopeId" || key === "parentScopeId") continue;
      properties.push([this.formatKey(key), this.stringifyValue(value)]);
    }
  }

  private formatLabel(
    category: string,
    action: string,
    payload: Record<string, unknown>
  ): string {
    const base = `${this.capitalize(category)} ${this.capitalize(action)}`;

    // Add key if present (common for queries)
    if (payload.key !== undefined) {
      return `${base} • ${this.stringifyValue(payload.key)}`;
    }

    return base;
  }

  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }

  private stringifyValue(value: unknown): string {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (value instanceof Error) {
      return value.message;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private capitalize(value: string): string {
    if (value.length === 0) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private cleanupMarks(startMark: string, endMark: string): void {
    try {
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
    } catch {
      // Ignore cleanup errors
    }
  }
}
