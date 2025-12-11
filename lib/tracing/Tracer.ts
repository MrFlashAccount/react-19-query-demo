import type {
  Span,
  SpanTypePattern,
  TraceEvent,
  TraceListener,
  LibrarySpanType,
  NoopSpanType,
} from "./types";
import { noop, noopcb } from "../utils";

/**
 * Internal state for an active span
 */
interface ActiveSpan {
  spanType: string;
  startTime: number;
}

/**
 * Tracer class for creating and managing spans.
 *
 * @template T - The span type pattern (defaults to LibrarySpanType)
 *
 * @example
 * ```typescript
 * // Library usage with autocomplete
 * const tracer = new Tracer<LibrarySpanType>();
 * const span = tracer.startSpan("query:fetch", { key: "users" });
 *
 * // User extension
 * type AppSpanType = LibrarySpanType | "app:custom";
 * const appTracer = new Tracer<AppSpanType>();
 * ```
 */
class TracerImpl<T extends SpanTypePattern = LibrarySpanType> {
  private listeners = new Set<TraceListener<T>>();
  private activeSpans = new Map<string, ActiveSpan>();

  /**
   * Subscribe to all trace events.
   * @param listener - Function called for each trace event
   * @returns Unsubscribe function
   */
  subscribe(listener: TraceListener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Check if there are any active listeners.
   */
  hasListeners(): boolean {
    return this.listeners.size > 0;
  }

  /**
   * Start a new root span.
   * @param spanType - The type of span to create
   * @param payload - Optional payload data
   * @returns A Span handle
   */
  startSpan(spanType: T, payload: Record<string, unknown> = {}): Span {
    return this.createSpan(spanType, payload, undefined);
  }

  /**
   * Get the number of currently active spans (for debugging).
   */
  getActiveSpanCount(): number {
    return this.activeSpans.size;
  }

  private createSpan(
    spanType: T,
    payload: Record<string, unknown>,
    parentSpanId: string | undefined
  ): Span {
    // Early return with no-op span if no listeners
    if (!this.hasListeners()) {
      return this.createNoOpSpan();
    }

    const spanId = this.generateId();
    const timestamp = performance.now();

    this.activeSpans.set(spanId, { spanType, startTime: timestamp });

    // Emit start event
    this.emit({
      kind: "start",
      spanId,
      parentSpanId,
      spanType,
      payload,
      timestamp,
    });

    let ended = false;

    const span: Span<T> = {
      spanType,
      spanId,
      parentSpanId,

      event: (name: string, eventPayload?: Record<string, unknown>) => {
        if (ended || !this.hasListeners()) return;
        this.emit({
          kind: "event",
          spanId,
          name,
          parentSpanId,
          payload: eventPayload,
          timestamp: performance.now(),
        });
      },

      success: (endPayload?: Record<string, unknown>) => {
        if (ended) return;
        ended = true;
        this.activeSpans.delete(spanId);
        this.emit({
          kind: "end",
          spanId,
          status: "success",
          payload: endPayload,
          parentSpanId,
          timestamp: performance.now(),
          spanType,
        });
      },

      error: (error: unknown, endPayload?: Record<string, unknown>) => {
        if (ended) return;
        ended = true;
        this.activeSpans.delete(spanId);
        this.emit({
          kind: "end",
          spanId,
          status: "error",
          error,
          payload: endPayload,
          parentSpanId,
          timestamp: performance.now(),
          spanType,
        });
      },

      child: <CT extends SpanTypePattern>(
        childSpanType: CT,
        childPayload: Record<string, unknown> = {}
      ): Span => {
        return this.createSpan(
          childSpanType as unknown as T,
          childPayload,
          spanId
        );
      },
    };

    return span;
  }

  private createNoOpSpan(): Span {
    const noOpSpan: Span<NoopSpanType> = {
      spanType: ":",
      spanId: "",
      parentSpanId: undefined,
      event: noop,
      success: noop,
      error: noop,
      child: () => noOpSpan,
    };
    return noOpSpan;
  }

  private emit(event: TraceEvent<T>): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (e) {
        console.error("Tracer listener error:", e);
      }
    });
  }

  private generateId(): string {
    return `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  }
}

/**
 * Null tracer that does nothing - used in production builds
 */
class NullTracer<T extends SpanTypePattern = LibrarySpanType> {
  private noOpSpan: Span<NoopSpanType> = {
    spanType: ":",
    spanId: "",
    parentSpanId: undefined,
    event: noop,
    success: noop,
    error: noop,
    child: () => this.noOpSpan,
  };

  subscribe(_listener: TraceListener<T>): () => void {
    return noopcb();
  }

  hasListeners(): boolean {
    return false;
  }

  startSpan(_spanType: T, _payload?: Record<string, unknown>): Span {
    return this.noOpSpan;
  }

  getActiveSpanCount(): number {
    return 0;
  }
}

/**
 * Tracer interface - common shape for both implementations
 */
export interface Tracer<T extends SpanTypePattern = LibrarySpanType> {
  subscribe(listener: TraceListener<T>): () => void;
  hasListeners(): boolean;
  startSpan(spanType: T, payload?: Record<string, unknown>): Span;
  getActiveSpanCount(): number;
}

/**
 * Create a new tracer instance.
 * In production, returns a null tracer that does nothing.
 * In development, returns a full tracer implementation.
 */
function createTracer<
  T extends SpanTypePattern = LibrarySpanType
>(): Tracer<T> {
  if (import.meta.env.DEV) {
    return new TracerImpl<T>();
  }
  return new NullTracer<T>();
}

/**
 * Global tracer instance for library use.
 * Pre-typed with LibrarySpanType for autocomplete.
 */
export const tracer: Tracer<LibrarySpanType> = createTracer<LibrarySpanType>();
