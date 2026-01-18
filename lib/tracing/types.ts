import { brand } from "../types";

export type SpanState = "inactive" | "running" | "success" | "error";

export type Color =
  | "primary"
  | "primary-light"
  | "primary-dark"
  | "secondary"
  | "secondary-light"
  | "secondary-dark"
  | "tertiary"
  | "tertiary-light"
  | "tertiary-dark"
  | "error";

export interface ISpanMeta {
  description?: string;
  color?: Color;
}

export interface ISpanOptions {
  name: string;
  payload?: Record<string, unknown>;
  parentSpan: ISpan | undefined;
  meta?: ISpanMeta;
  emit: (event: TraceEvent) => void;
}

export interface ISpanChildOptions {
  name: string;
  payload?: Record<string, unknown>;
  meta?: ISpanMeta;
}

export type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: Serializable }
  | Serializable[];

export type ISpanPayload = Serializable;
export const SpanId = brand<`${string}-${string}`, "SpanId">();
export type SpanId = typeof SpanId.type;

/**
 * A handle to a span.
 * Provides methods to control lifecycle and record events.
 */
export interface ISpan extends Disposable {
  /** Display name of the span */
  readonly name: string;

  /** Unique identifier for this span */
  readonly spanId: SpanId;

  /** Current state of the span */
  readonly state: SpanState;

  /** Parent span if this is a child span */
  readonly parentSpan: ISpan | undefined;

  /** Payload data passed when span was created */
  readonly payload: Record<string, unknown>;

  /** Metadata for display purposes */
  readonly meta: ISpanMeta;

  /** Timestamp when span was started (-1 if not started) */
  readonly startTime: number;

  /** Timestamp when span ended (-1 if not ended) */
  readonly endTime: number;

  /** Serialized payload */
  readonly serializedPayload: string;

  /** Duration of the span in milliseconds */
  readonly duration: number;

  /**
   * Start the span. Must be called before any other operations.
   * No-op if already started or ended.
   */
  start(): void;

  /**
   * Record an intermediate event within this span.
   * @param eventName - Name of the event
   * @param payload - Optional payload data
   */
  event(eventName: string, payload?: Record<string, unknown>): void;

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
   * Child is created in inactive state - must call start() separately.
   * @param options - Options for the child span
   * @returns A new ISpan handle for the child
   */
  child(options: ISpanChildOptions): ISpan;
}

/**
 * Abstract base class for all span implementations.
 * Enforces ISpan contract and enables `instanceof` type checking.
 * All span implementations MUST extend this class.
 */
export abstract class SpanBase implements ISpan {
  abstract readonly name: string;
  abstract readonly spanId: SpanId;
  abstract readonly state: SpanState;
  abstract readonly parentSpan: ISpan | undefined;
  abstract readonly payload: Record<string, unknown>;
  abstract readonly meta: ISpanMeta;
  abstract readonly startTime: number;
  abstract readonly endTime: number;
  abstract readonly serializedPayload: string;
  abstract readonly duration: number;

  abstract start(): void;
  abstract event(eventName: string, payload?: Record<string, unknown>): void;
  abstract success(payload?: Record<string, unknown>): void;
  abstract error(error: unknown, payload?: Record<string, unknown>): void;
  abstract child(options: ISpanChildOptions): ISpan;
  abstract [Symbol.dispose](): void;
}

// ============================================
// TRACE EVENT TYPES
// ============================================

/**
 * Event emitted when a span starts.
 * Contains the span instance and parent span reference.
 */
export interface SpanStartEvent {
  readonly kind: "start";
  /** The span that started */
  readonly span: ISpan;
  /** Parent span (undefined for root spans) */
  readonly parentSpan: ISpan | undefined;
  /** Name of the span */
  readonly name: string;
  /** Payload data passed at creation */
  readonly payload: Record<string, unknown>;
  /** Timestamp when span started */
  readonly timestamp: number;
}

/**
 * Base fields shared by all span end events.
 */
interface SpanEndEventBase {
  readonly kind: "end";
  /** The span that ended */
  readonly span: ISpan;
  /** Parent span (undefined for root spans) */
  readonly parentSpan: ISpan | undefined;
  /** Optional end payload */
  readonly payload?: Record<string, unknown>;
  /** Timestamp when span ended */
  readonly timestamp: number;
}

/**
 * Event emitted when a span ends successfully.
 */
export interface SpanSuccessEvent extends SpanEndEventBase {
  readonly status: "success";
}

/**
 * Event emitted when a span ends with an error.
 */
export interface SpanErrorEvent extends SpanEndEventBase {
  readonly status: "error";
  /** The error that caused the span to fail */
  readonly error: unknown;
}

/**
 * Event emitted when a span ends.
 * Discriminated union based on status.
 */
export type SpanEndEvent = SpanSuccessEvent | SpanErrorEvent;

/**
 * Intermediate event emitted during a span's lifetime.
 */
export interface SpanEvent {
  readonly kind: "event";
  /** The span this event belongs to */
  readonly span: ISpan;
  /** Parent span (undefined for root spans) */
  readonly parentSpan: ISpan | undefined;
  /** Name of the event */
  readonly eventName: string;
  /** Optional event payload */
  readonly payload?: Record<string, unknown>;
  /** Timestamp of the event */
  readonly timestamp: number;
}

/**
 * Union of all trace event types.
 */
export type TraceEvent = SpanStartEvent | SpanEndEvent | SpanEvent;

// ============================================
// REPORTER INTERFACE
// ============================================

/**
 * Interface for objects that can receive trace events.
 * This is the minimal contract that Tracer requires.
 */
export interface IEventReceiver {
  /**
   * Called by Tracer when a trace event occurs.
   * @param event - The trace event (start, end, or intermediate event)
   */
  handleEvent(event: TraceEvent): void;
}

export interface ITracerOptions {
  reporters?: IEventReceiver[];
}

/**
 * Tracer interface - common shape for both implementations
 */
export interface ITracer {
  /**
   * Register a reporter to receive trace events.
   * @param receiver - Object implementing IEventReceiver
   * @returns Unregister function to remove the reporter
   */
  addReporter(receiver: IEventReceiver): () => void;

  /**
   * Delete a reporter from the tracer.
   * @param receiver - Object implementing IEventReceiver
   */
  deleteReporter(receiver: IEventReceiver): void;

  /**
   * Check if any reporters are registered.
   */
  hasReporters(): boolean;

  /**
   * Create a new span without starting it.
   * Call span.start() when ready to begin tracing.
   */
  createSpan(
    name: string,
    payload?: Record<string, unknown>,
    meta?: ISpanMeta
  ): ISpan;

  /**
   * Create and start a new span immediately.
   * Convenience method equivalent to createSpan + start.
   */
  startSpan(
    name: string,
    payload?: Record<string, unknown>,
    meta?: ISpanMeta
  ): ISpan;
}
