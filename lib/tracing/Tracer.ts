import { serializePayload } from "../utils";
import type {
  TraceEvent,
  ISpan,
  SpanStartEvent,
  SpanEndEvent,
  SpanEvent,
  ISpanMeta,
  ISpanOptions,
  ISpanChildOptions,
  ITracer,
  IEventReceiver,
  ITracerOptions,
} from "./types";

type SpanState = "inactive" | "running" | "ended";

const defaultMeta: ISpanMeta = { description: "", color: "primary" };

/**
 * Span represents a unit of work being traced.
 * Must be started explicitly after creation.
 */
export class Span implements ISpan {
  private _state: SpanState = "inactive";
  private readonly _spanId: string;
  private readonly _name: string;
  private readonly _payload: Record<string, unknown>;
  private readonly _parentSpan: ISpan | undefined;
  private readonly _meta: ISpanMeta;
  private readonly emitEvent: (event: TraceEvent) => void;
  private _startTime: number = 0;
  private _endTime: number = 0;

  constructor(options: ISpanOptions) {
    this._name = options.name;
    this._parentSpan = options.parentSpan;
    this._payload = options.payload ?? {};
    this.emitEvent = options.emit;
    this._spanId = this.generateId();
    this._meta = options.meta ?? defaultMeta;
  }

  get state(): SpanState {
    return this._state;
  }

  get duration(): number {
    return Math.max(0, this._endTime - this._startTime);
  }

  get spanId(): string {
    return this._spanId;
  }

  get name(): string {
    return this._name;
  }

  get parentSpan(): ISpan | undefined {
    return this._parentSpan;
  }

  get payload(): Record<string, unknown> {
    return this._payload;
  }

  get serializedPayload(): string {
    return serializePayload(this._payload);
  }

  get meta(): ISpanMeta {
    return this._meta;
  }

  get startTime(): number {
    return this._startTime;
  }

  get endTime(): number {
    return this._endTime;
  }

  /**
   * Start the span. Must be called before any other operations.
   * No-op if already started or ended.
   */
  start(): void {
    if (this._state !== "inactive") {
      return;
    }

    this._startTime = performance.now();
    this._state = "running";

    const event: SpanStartEvent = {
      kind: "start",
      span: this,
      parentSpan: this._parentSpan,
      name: this._name,
      payload: this._payload,
      timestamp: this._startTime,
    };

    this.emitEvent(event);
  }

  /**
   * End the span with success status.
   * No-op if not running.
   */
  success(payload?: Record<string, unknown>): void {
    this.end("success", payload);
  }

  /**
   * End the span with error status.
   * No-op if not running.
   */
  error(error: unknown, payload?: Record<string, unknown>): void {
    this.end("error", payload, error);
  }

  /**
   * Record an intermediate event within this span.
   * No-op if not running.
   */
  event(eventName: string, payload?: Record<string, unknown>): void {
    if (this._state !== "running") {
      return;
    }

    const ev: SpanEvent = {
      kind: "event",
      span: this,
      parentSpan: this._parentSpan,
      eventName,
      payload,
      timestamp: performance.now(),
    };

    this.emitEvent(ev);
  }

  /**
   * Create a child span nested under this span.
   * Child is created in inactive state - must call start() separately.
   */
  child(options: ISpanChildOptions): ISpan {
    const childSpan = new Span({
      name: options.name,
      payload: options.payload ?? {},
      parentSpan: this,
      meta: options.meta,
      emit: this.emitEvent,
    });
    childSpan.start();
    return childSpan;
  }

  private end(
    status: "success" | "error",
    payload?: Record<string, unknown>,
    error?: unknown
  ): void {
    if (this._state !== "running") {
      return;
    }

    this._endTime = performance.now();
    this._state = "ended";

    const base = {
      kind: "end" as const,
      span: this,
      parentSpan: this._parentSpan,
      payload,
      timestamp: this._endTime,
    };

    const event: SpanEndEvent =
      status === "error"
        ? { ...base, status: "error", error }
        : { ...base, status: "success" };

    this.emitEvent(event);
  }

  private generateId(): string {
    return `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  }

  [Symbol.dispose](): void {
    if (this._state === "running") {
      this.success();
    }
  }
}

/**
 * Tracer class for creating and managing spans.
 *
 * @example
 * ```typescript
 * const tracer = new Tracer();
 * const span = tracer.startSpan("Fetch Users", { key: "users" });
 * // ... do work
 * span.success();
 * ```
 */
export class Tracer implements ITracer {
  private reporters: IEventReceiver[] = [];

  constructor(options: ITracerOptions = {}) {
    this.reporters = options.reporters ?? [];
  }

  /**
   * Delete a reporter from the tracer.
   * @param receiver - Object implementing IEventReceiver
   */
  deleteReporter(receiver: IEventReceiver): void {
    this.reporters = this.reporters.filter((r) => r !== receiver);
  }

  /**
   * Register a reporter to receive trace events.
   * @param receiver - Object implementing IEventReceiver
   * @returns Unregister function to remove the reporter
   */
  addReporter(receiver: IEventReceiver): () => void {
    this.reporters.push(receiver);
    return () => this.deleteReporter(receiver);
  }

  /**
   * Check if any reporters are registered.
   */
  hasReporters(): boolean {
    return this.reporters.length > 0;
  }

  /**
   * Create a new span without starting it.
   * Call span.start() when ready to begin tracing.
   */
  createSpan(
    name: string,
    payload: Record<string, unknown> = {},
    meta?: ISpanMeta
  ): ISpan {
    return new Span({
      name,
      payload,
      parentSpan: undefined,
      emit: (event) => this.emit(event),
      meta,
    });
  }

  /**
   * Create and start a new span immediately.
   * Convenience method equivalent to createSpan + start.
   */
  startSpan(
    name: string,
    payload: Record<string, unknown> = {},
    meta?: ISpanMeta
  ): ISpan {
    const span = this.createSpan(name, payload, meta);
    span.start();
    return span;
  }

  private emit(event: TraceEvent): void {
    this.reporters.forEach((reporter) => {
      try {
        reporter.handleEvent(event);
      } catch (e) {
        console.error("Reporter error:", e);
      }
    });
  }
}
