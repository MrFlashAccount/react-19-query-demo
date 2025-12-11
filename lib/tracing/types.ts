// ============================================
// SPAN TYPE DEFINITIONS
// ============================================

/**
 * Enforce "category:action" pattern for span types.
 * This ensures all span types follow a consistent naming convention.
 */
export type SpanTypePattern = `${string}:${string}`;

/**
 * Query-related span types
 */
export type QuerySpanType = "query:fetch" | "query:prefetch";

/**
 * Mutation-related span types
 */
export type MutationSpanType =
  | "mutation:execute"
  | "mutation:invalidate"
  | "mutation:optimistic";

/**
 * Client-level span types
 */
export type ClientSpanType = "client:invalidation";

/**
 * All library-defined span types.
 * Users can extend this by using the generic Tracer with their own types.
 */
export type LibrarySpanType = QuerySpanType | MutationSpanType | ClientSpanType;

// ============================================
// TRACE EVENT TYPES
// ============================================

/**
 * Event emitted when a span starts.
 * @template T - The span type pattern (defaults to any valid pattern)
 */
export interface SpanStartEvent<T extends SpanTypePattern = SpanTypePattern> {
  readonly kind: "span:start";
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly spanType: T;
  readonly payload: Record<string, unknown>;
  readonly timestamp: number;
}

/**
 * Event emitted when a span ends.
 * Status is either "success" or "error" - no "pending" state.
 */
export interface SpanEndEvent {
  readonly kind: "span:end";
  readonly spanId: string;
  readonly status: "success" | "error";
  readonly error?: unknown;
  readonly payload?: Record<string, unknown>;
  readonly timestamp: number;
}

/**
 * Intermediate event emitted during a span's lifetime.
 */
export interface SpanEvent {
  readonly kind: "span:event";
  readonly spanId: string;
  readonly name: string;
  readonly payload?: Record<string, unknown>;
  readonly timestamp: number;
}

/**
 * Union of all trace event types.
 * @template T - The span type pattern for start events
 */
export type TraceEvent<T extends SpanTypePattern = SpanTypePattern> =
  | SpanStartEvent<T>
  | SpanEndEvent
  | SpanEvent;

// ============================================
// SPAN HANDLE (returned to user)
// ============================================

/**
 * A handle to an active span.
 * Provides methods to record events and end the span.
 */
export interface Span {
  /** Unique identifier for this span */
  readonly spanId: string;

  /** Parent span ID if this is a child span */
  readonly parentSpanId?: string;

  /**
   * Record an intermediate event within this span.
   * @param name - Name of the event
   * @param payload - Optional payload data
   */
  event(name: string, payload?: Record<string, unknown>): void;

  /**
   * End the span with a successful status.
   * @param payload - Optional payload data for the end event
   */
  success(payload?: Record<string, unknown>): void;

  /**
   * End the span with an error status.
   * @param error - The error that occurred
   * @param payload - Optional additional payload data
   */
  error(error: unknown, payload?: Record<string, unknown>): void;

  /**
   * Create a child span nested under this span.
   * @param spanType - The type of the child span
   * @param payload - Optional payload data for the child span
   * @returns A new Span handle for the child
   */
  child<T extends SpanTypePattern>(
    spanType: T,
    payload?: Record<string, unknown>
  ): Span;
}

/**
 * Listener function type for trace events.
 */
export type TraceListener<T extends SpanTypePattern = SpanTypePattern> = (
  event: TraceEvent<T>
) => void;
