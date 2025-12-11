import { noop } from "@tanstack/react-query";
import {
  tracer,
  type TraceEvent,
  type SpanStartEvent,
  type SpanEndEvent,
  type SpanEvent,
} from "../tracing";
import {
  StatusIcons,
  UIColors,
  getCategoryColor,
  getStatusColor,
  getCategoryIcon,
} from "./constants";
import { Batcher } from "./Batcher";

/**
 * Internal metrics for an active span
 */
interface SpanMetrics {
  spanId: string;
  parentSpanId?: string;
  spanType: string;
  startedAt: number;
  payload: Record<string, unknown>;
  events: Array<{
    name: string;
    timestamp: number;
    payload?: Record<string, unknown>;
  }>;
}

export interface LoggerOptions {
  /**
   * Whether to show scope summaries when a scope completes
   * @default true
   */
  showSummary?: boolean;
  /**
   * Whether to show payload details in logs
   * @default true
   */
  showPayloadDetails?: boolean;
  /**
   * Whether to use console.group for nested logging
   * @default true
   */
  useGrouping?: boolean;
}

/**
 * Logger listens to trace events and logs them to the console.
 * Useful for debugging during development.
 */
export class Logger {
  private spans = new Map<string, SpanMetrics>();
  private unsubscribe: () => void = noop;
  private options: Required<LoggerOptions>;
  private batcher = new Batcher<TraceEvent>({
    onFlush: (events) => {
      events.forEach((event) => {
        this.handleEvent(event);
      });
    },
  });

  constructor(options: LoggerOptions = {}) {
    this.options = {
      showSummary: options.showSummary ?? true,
      showPayloadDetails: options.showPayloadDetails ?? true,
      useGrouping: options.useGrouping ?? true,
    };
  }

  /**
   * Start listening to trace events
   */
  start(): void {
    if (this.unsubscribe !== noop) return;
    this.unsubscribe = tracer.subscribe((event) => {
      this.batcher.push(event);
      if (event.kind === "end" && event.parentSpanId === undefined) {
        this.batcher.flush();
      }
    });
  }

  /**
   * Stop listening and clear all state
   */
  stop(): void {
    this.unsubscribe();
    this.unsubscribe = noop;
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
   * Get current active spans (for debugging)
   */
  getActiveSpans(): SpanMetrics[] {
    return Array.from(this.spans.values());
  }

  // ============================================
  // EVENT HANDLING
  // ============================================

  private handleEvent(event: TraceEvent): void {
    switch (event.kind) {
      case "start":
        this.handleSpanStart(event);
        break;
      case "end":
        this.handleSpanEnd(event);
        break;
      case "event":
        this.handleSpanEvent(event);
        break;
    }
  }

  private handleSpanStart(event: SpanStartEvent): void {
    const metrics: SpanMetrics = {
      spanId: event.spanId,
      parentSpanId: event.parentSpanId,
      spanType: event.spanType,
      startedAt: event.timestamp,
      payload: event.payload,
      events: [],
    };
    this.spans.set(event.spanId, metrics);

    // Start a console group for this span
    if (this.options.useGrouping) {
      const [category, action] = event.spanType.split(":");
      const icon = getCategoryIcon(category);
      const color = getCategoryColor(category);

      console.groupCollapsed(
        `%c${icon} ${this.capitalize(category)} ${this.capitalize(action)}`,
        `color: ${color.hex}; font-weight: bold;`
      );
    }

    // Log the start event
    this.logSpanStart(event);
  }

  private handleSpanEnd(event: SpanEndEvent): void {
    const metrics = this.spans.get(event.spanId);
    if (!metrics) return;

    const duration = event.timestamp - metrics.startedAt;

    // Log the end event
    this.logSpanEnd(event, duration);

    // Log summary if enabled
    if (this.options.showSummary) {
      this.logSpanSummary(metrics, event, duration);
    }

    // End the console group
    if (this.options.useGrouping) {
      console.groupEnd();
    }

    this.spans.delete(event.spanId);
  }

  private handleSpanEvent(event: SpanEvent): void {
    const metrics = this.spans.get(event.spanId);
    if (!metrics) return;

    const elapsed = event.timestamp - metrics.startedAt;
    metrics.events.push({
      name: event.name,
      timestamp: elapsed,
      payload: event.payload,
    });

    // Log the intermediate event
    console.log(
      `%c${StatusIcons.event} ${event.name} %c+${elapsed.toFixed(2)}ms`,
      `color: ${UIColors.separator}; font-weight: bold;`,
      `color: ${UIColors.timestamp}; font-size: 0.9em;`
    );

    if (this.options.showPayloadDetails && event.payload) {
      console.log("  Details:", event.payload);
    }
  }

  // ============================================
  // LOGGING HELPERS
  // ============================================

  private logSpanStart(event: SpanStartEvent): void {
    const [category] = event.spanType.split(":");
    const color = getCategoryColor(category);

    console.log(
      `%c${StatusIcons.start} Started %c+0.00ms`,
      `color: ${color.hex}; font-weight: bold;`,
      `color: ${UIColors.timestamp}; font-size: 0.9em;`
    );

    if (this.options.showPayloadDetails) {
      this.logPayloadDetails(event.spanType, event.payload);
    }
  }

  private logSpanEnd(event: SpanEndEvent, duration: number): void {
    const statusColor = getStatusColor(event.status);
    const icon = StatusIcons[event.status];
    const statusLabel = event.status === "success" ? "Completed" : "Failed";

    console.log(
      `%c${icon} ${statusLabel} %c+${duration.toFixed(2)}ms`,
      `color: ${statusColor.hex}; font-weight: bold;`,
      `color: ${UIColors.timestamp}; font-size: 0.9em;`
    );

    if (event.status === "error" && event.error) {
      console.error("   Error:", event.error);
    }

    if (this.options.showPayloadDetails && event.payload) {
      console.log("   Result:", event.payload);
    }
  }

  private logPayloadDetails(
    spanType: string,
    payload: Record<string, unknown>
  ): void {
    const [category] = spanType.split(":");

    if (category === "query") {
      if (payload.key !== undefined) {
        console.log("  Key:", payload.key);
      }
    } else if (category === "mutation") {
      if (payload.variables !== undefined) {
        console.log("  Variables:", payload.variables);
      }
      if (payload.queries !== undefined) {
        console.log("  Queries:", payload.queries);
      }
    } else if (category === "client") {
      if (payload.queries !== undefined) {
        console.log("  Queries:", payload.queries);
      }
    }
  }

  private logSpanSummary(
    metrics: SpanMetrics,
    endEvent: SpanEndEvent,
    duration: number
  ): void {
    console.groupCollapsed(
      `%cSpan Summary`,
      `color: ${UIColors.separator}; font-weight: bold;`
    );
    console.log(`Type: ${metrics.spanType}`);
    console.log(`Status: ${StatusIcons[endEvent.status]} ${endEvent.status}`);
    console.log(`Duration: ${duration.toFixed(2)}ms`);
    console.log(`Events: ${metrics.events.length}`);
    console.groupEnd();

    if (metrics.events.length > 0) {
      const tableData = metrics.events.map((event) => ({
        Event: event.name,
        Timestamp: `+${event.timestamp.toFixed(2)}ms`,
        Details: event.payload ? JSON.stringify(event.payload) : "-",
      }));
      console.table(tableData);
    }
  }

  // ============================================
  // FORMATTING HELPERS
  // ============================================

  private capitalize(value: string): string {
    if (value.length === 0) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
