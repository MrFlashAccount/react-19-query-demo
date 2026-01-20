import { Tracer } from "./Tracer";
import { NullTracer } from "./NullTracer";
import type { ITracer } from "./types";

export type {
  SpanStartEvent,
  SpanEndEvent,
  SpanSuccessEvent,
  SpanErrorEvent,
  SpanEvent,
  TraceEvent,
  ISpan,
  SpanState,
  ITracer,
  IEventReceiver,
  ISpanMeta,
  Color,
} from "./types";

export { SpanBase } from "./types";

// Re-export ISpan as Span for backwards compatibility
export type { ISpan as Span } from "./types";

// Re-export reporter system
export {
  BaseReporter,
  LoggerReporter,
  DevtoolsReporter,
  FlameGraphReporter,
} from "./reporters";

export type {
  IReporter,
  BaseReporterOptions,
  SpanMetrics,
  LoggerReporterOptions,
  DevtoolsReporterOptions,
  FlameGraphReporterOptions,
  FlameGraphSpan,
} from "./reporters";

let tracer: ITracer = import.meta.env.DEV ? new Tracer() : new NullTracer();

function setupTracer(newTracer: ITracer): void {
  tracer = newTracer;
}

export { tracer, Tracer, setupTracer, NullTracer };
// Helpers
export { isSpan, traced, Traced, tracePromise, runInSpan } from "./helpers";
