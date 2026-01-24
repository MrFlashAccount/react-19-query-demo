import type { IEventReceiver, TraceEvent, SpanStartEvent, SpanEvent, SpanId } from "../types";

import { Batcher } from "../Batcher";
import { noop } from "../utils";

import { IReporter, type BaseReporterOptions, type SpanMetrics } from "./types";

/**
 * Abstract base class for implementing reporters.
 *
 * Provides:
 * - Lifecycle management (start/stop)
 * - Optional batching of events
 * - Span tracking utilities
 * - Event dispatch to typed handlers
 *
 * @example
 * ```typescript
 * class MyReporter extends BaseReporter {
 *   protected onSpanStart(event: SpanStartEvent): void {
 *     console.log("Span started:", event.name);
 *   }
 *
 *   protected onSpanEnd(event: SpanEndEvent): void {
 *     console.log("Span ended:", event.span.spanId);
 *   }
 * }
 *
 * const reporter = new MyReporter(tracer);
 * reporter.start();
 * ```
 */
export abstract class BaseReporter extends IReporter implements IEventReceiver {
  private unregister: () => void = noop;
  private batcher?: Batcher<TraceEvent>;

  private readonly options: Required<BaseReporterOptions>;
  protected readonly spans = new Map<SpanId, SpanMetrics>();

  constructor(options: BaseReporterOptions = {}) {
    super();

    this.options = {
      useBatching: options.useBatching ?? false,
    };

    if (this.options.useBatching) {
      this.batcher = new Batcher<TraceEvent>({
        process: (events) => {
          this.processEvents(events);
        },
      });
    }
  }

  /**
   * Whether the reporter is currently receiving events.
   */
  get isActive(): boolean {
    return this.unregister !== noop;
  }

  /**
   * Start receiving trace events.
   * No-op if already started.
   */
  start(): void {
    if (this.isActive) return;
    this.onStart();
  }

  /**
   * Stop receiving trace events and cleanup.
   * No-op if already stopped.
   */
  stop(): void {
    // Flush any pending batched events
    this.batcher?.flush({ sync: true });

    this.unregister();
    this.unregister = noop;
    this.spans.clear();
    this.onStop();
  }

  /**
   * Called when the reporter starts. Override in subclass.
   */
  protected onStart(): void {}

  /**
   * Called when the reporter stops. Override in subclass.
   */
  protected onStop(): void {}

  /**
   * IEventReceiver implementation - called by Tracer.
   */
  handleEvent(event: TraceEvent): void {
    if (this.batcher) {
      this.batcher.push(event);
      // Flush on root span end for timely reporting
      if (event.kind === "end" && event.parentSpan === undefined) {
        this.batcher.flush();
      }
    } else {
      this.processEvents([event]);
    }
  }

  protected abstract processEvents(events: TraceEvent[]): void;

  /**
   * Track a span's start. Call from onSpanStart if you need
   * to correlate start/end events.
   */
  protected trackSpanStart(event: SpanStartEvent): SpanMetrics {
    const metrics: SpanMetrics = {
      spanId: event.span.spanId,
      parentSpanId: event.parentSpan?.spanId,
      name: event.name,
      startedAt: event.timestamp,
      payload: event.payload,
      events: [],
    };
    this.spans.set(event.span.spanId, metrics);
    return metrics;
  }

  /**
   * Get tracked metrics for a span.
   * Returns undefined if span wasn't tracked or already ended.
   */
  protected getSpanMetrics(spanId: SpanId): SpanMetrics | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Stop tracking a span. Call from onSpanEnd.
   * Returns the metrics if they existed.
   */
  protected untrackSpan(spanId: SpanId): SpanMetrics | undefined {
    const metrics = this.spans.get(spanId);
    this.spans.delete(spanId);
    return metrics;
  }

  /**
   * Record an intermediate event on a tracked span.
   */
  protected recordSpanEvent(event: SpanEvent): void {
    const metrics = this.spans.get(event.span.spanId);
    if (!metrics) return;

    metrics.events.push({
      name: event.eventName,
      timestamp: event.timestamp,
      payload: event.payload,
    });
  }
}
