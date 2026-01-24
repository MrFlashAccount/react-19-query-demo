/**
 * Tracing helpers with explicit parent passing via options.
 * Works in any environment without async context dependencies.
 */

import { type TracedOptions, executeWithSpan, createTracedDecorator } from "./shared";
import { SpanBase, type ISpan, type ISpanMeta } from "./types";

import { tracer } from "./index";

/**
 * Type guard to check if value is a span instance.
 * Uses instanceof for reliable runtime type checking.
 */
export const isSpan = (v: unknown): v is ISpan => {
  return v instanceof SpanBase;
};

// ============================================
// Internal Helpers
// ============================================

/**
 * Create span - child if parent exists, root otherwise.
 */
const createSpan = (
  name: string,
  meta: ISpanMeta | undefined,
  payload: Record<string, unknown> = {},
  parentSpan?: ISpan,
): ISpan => {
  if (parentSpan) {
    const child = parentSpan.child({ name, payload, meta });
    return child;
  }
  return tracer.startSpan(name, payload, meta);
};

// ==========================================
// HOF & Decorator
// ==========================================

/**
 * HOF that wraps a function with span tracing.
 * Parent span is passed via options.parentSpan.
 * Handles both sync and async functions.
 *
 * @example
 * const fetchUser = traced(
 *   async (span: ISpan, id: string) => api.get(`/users/${id}`),
 *   { name: "fetchUser", meta: { color: "primary" } }
 * );
 *
 * await fetchUser("123"); // root span
 */
export function traced<TArgs extends unknown[], TReturn>(
  fn: (span: ISpan, ...args: TArgs) => TReturn,
  options: TracedOptions,
): (...args: TArgs) => TReturn {
  function withSpan(this: any, ...args: TArgs): TReturn {
    const { name, payload = {}, meta, parentSpan } = options;
    const span = createSpan(name, meta, payload, parentSpan);
    return executeWithSpan(span, (span) => {
      span.start();
      return fn(span, ...args);
    });
  }

  return withSpan;
}

/**
 * Method decorator that wraps method with span tracing.
 * Parent span is passed via options.parentSpan.
 *
 * @example
 * class UserService {
 *   @Traced("getUser", { color: "primary" })
 *   async getUser(id: string, span?: ISpan) {
 *     return this.repo.findById(id);
 *   }
 * }
 */
export const Traced = createTracedDecorator(traced);

// ============================================
// Promise Helper
// ============================================

/**
 * Attach span lifecycle to an existing promise.
 * Calls success/error on promise resolution/rejection.
 *
 * @example
 * const span = tracer.startSpan("fetch", {}, { color: "primary" });
 * const result = await tracePromise(fetch("/api"), span);
 */
export function tracePromise<T, P extends PromiseLike<T>>(
  promise: P,
  spanOrSpanOptions: ISpan | TracedOptions,
): P {
  const span = isSpan(spanOrSpanOptions)
    ? spanOrSpanOptions
    : createSpan(
        spanOrSpanOptions.name,
        spanOrSpanOptions.meta,
        spanOrSpanOptions.payload ?? {},
        spanOrSpanOptions.parentSpan,
      );
  span.start();
  return promise.then(
    (val) => {
      span.success();
      return val;
    },
    (err) => {
      span.error(err);
      throw err;
    },
  ) as P;
}

export function runInSpan<T>(fn: (span: ISpan) => T, options: TracedOptions): T {
  const withSpan = traced((span: ISpan) => fn(span), options);
  return withSpan();
}
