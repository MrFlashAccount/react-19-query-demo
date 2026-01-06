import type { SpanStartEvent, SpanEndEvent, SpanEvent } from "../types";

/**
 * Internal metrics for tracking an active span within a reporter.
 * Common structure used by reporters that need to correlate start/end events.
 */
export interface SpanMetrics {
  spanId: string;
  parentSpanId?: string;
  name: string;
  startedAt: number;
  payload: Record<string, unknown>;
  events: Array<{
    name: string;
    timestamp: number;
    payload?: Record<string, unknown>;
  }>;
}

/**
 * Optional event handler methods that reporters can implement.
 * These provide a cleaner API than handling raw TraceEvent switch statements.
 */
export abstract class IReporterEventHandlers {
  protected abstract onSpanStart?(event: SpanStartEvent): void;
  protected abstract onSpanEnd?(event: SpanEndEvent): void;
  protected abstract onSpanEvent?(event: SpanEvent): void;
}

/**
 * Full reporter interface with lifecycle methods.
 */
export abstract class IReporter extends IReporterEventHandlers {
  /**
   * Start receiving trace events.
   * Registers the reporter with the tracer.
   */
  abstract start(): void;

  /**
   * Stop receiving trace events.
   * Unregisters the reporter and cleans up resources.
   */
  abstract stop(): void;

  /**
   * Check if the reporter is currently active.
   */
  abstract get isActive(): boolean;
}

/**
 * Options for BaseReporter configuration.
 */
export interface BaseReporterOptions {
  /**
   * Whether to use batching for event processing.
   * When enabled, events are collected and flushed together
   * using requestIdleCallback for better performance.
   * @default false
   */
  useBatching?: boolean;
}
