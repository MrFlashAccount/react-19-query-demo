import type { SpanId, TraceEvent } from "../types";

/**
 * Internal metrics for tracking an active span within a reporter.
 * Common structure used by reporters that need to correlate start/end events.
 */
export interface SpanMetrics {
  spanId: SpanId;
  parentSpanId?: SpanId | undefined;
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
 * Full reporter interface with lifecycle methods.
 */
export abstract class IReporter {
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

  /**
   * Process trace events.
   * @param events - The trace events to process.
   */
  protected abstract processEvents(events: TraceEvent[]): void;
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
