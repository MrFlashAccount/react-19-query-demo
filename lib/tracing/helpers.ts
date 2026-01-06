/**
 * Tracing helpers with explicit parent passing (last argument).
 * Works in any environment without async context dependencies.
 */

import type { ISpan, ISpanMeta, ISpanOptions } from "./types";
import { tracer } from "./index";
import { type AnyFn, executeWithSpan, createTracedDecorator } from "./shared";

/**
 * Type guard to check if value is an ISpan (duck-typed).
 * Checks for spanId string property - fast and compact.
 */
export const isSpan = (v: unknown): v is ISpan =>
  typeof (v as any)?.spanId === "string";

// ============================================
// Internal Helpers
// ============================================

/**
 * Extract parent span from args if last arg is ISpan.
 */
const extractParentSpan = (args: unknown[]): ISpan | undefined => {
  const last = args[args.length - 1];
  return isSpan(last) ? last : undefined;
};

/**
 * Create span - child if parent exists, root otherwise.
 */
const createSpan = (
  name: string,
  meta: ISpanMeta | undefined,
  payload: Record<string, unknown> = {},
  parent?: ISpan
): ISpan => {
  if (parent) {
    const child = parent.child({ name, payload, meta });
    return child;
  }
  return tracer.startSpan(name, payload, meta);
};

// ============================================
// HOF & Decorator
// ============================================

/**
 * HOF that wraps a function with span tracing.
 * If last arg is ISpan, creates child span; otherwise creates root span.
 * Handles both sync and async functions.
 *
 * @example
 * const fetchUser = traced(
 *   async (id: string, parent?: ISpan) => api.get(`/users/${id}`),
 *   "fetchUser",
 *   { color: "primary" }
 * );
 *
 * await fetchUser("123");           // root span
 * await fetchUser("123", parentSpan); // child span
 */
export function traced<T extends AnyFn>(
  fn: T,
  name: string,
  payload: Record<string, unknown> = {},
  meta?: ISpanMeta
): T {
  const wrapped = function (this: any, ...args: Parameters<T>): ReturnType<T> {
    const parent = extractParentSpan(args);
    const span = createSpan(name, meta, payload, parent);
    return executeWithSpan(span, (span) => {
      span.start();
      // If parent is provided(as a last argument), replace the last argument with the span
      if (parent !== undefined) {
        args[args.length - 1] = span;
      }
      return fn.apply(this, args);
    });
  };

  return wrapped as T;
}

/**
 * Method decorator that wraps method with span tracing.
 * If last arg is ISpan, creates child span; otherwise creates root span.
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
export function tracePromise<T>(
  promise: Promise<T>,
  spanOrSpanOptions: ISpan | ISpanOptions
): Promise<T> {
  const span = isSpan(spanOrSpanOptions)
    ? spanOrSpanOptions
    : tracer.startSpan(
        spanOrSpanOptions.name,
        spanOrSpanOptions.payload,
        spanOrSpanOptions.meta
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
    }
  );
}

export function runInSpan<T>(
  fn: (span: ISpan) => T,
  name: string,
  payload: Record<string, unknown> = {},
  meta?: ISpanMeta
): T {
  return traced((span: ISpan) => fn(span), name, payload, meta) as T;
}
