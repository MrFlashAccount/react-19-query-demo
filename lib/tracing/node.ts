/**
 * Tracing helpers using Node.js AsyncLocalStorage.
 * Provides automatic parent span propagation across async boundaries.
 *
 * For browser, use ./asynccontext.ts instead.
 */

import type { ISpan, ISpanMeta } from "./types";
import { tracer } from "./index";
import {
  type AnyFn,
  type TracedOptions,
  executeWithSpan,
  createTracedDecorator,
} from "./shared";

// ============================================
// Context (AsyncLocalStorage)
// ============================================

let spanContext: import("node:async_hooks").AsyncLocalStorage<ISpan>;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AsyncLocalStorage } = require("node:async_hooks");
  spanContext = new AsyncLocalStorage();
} catch {
  throw new Error(
    "AsyncLocalStorage not available. " +
      "This module requires Node.js. Use ./asynccontext.ts for browsers."
  );
}

/**
 * Get the current span from async context.
 * Returns undefined if no span is active.
 */
export function getCurrentSpan(): ISpan | undefined {
  return spanContext.getStore();
}

/**
 * Run a function with a span as the current context.
 * Nested calls will see this span as parent via getCurrentSpan().
 */
export function runWithSpan<R>(span: ISpan, fn: () => R): R {
  return spanContext.run(span, fn);
}

/**
 * Create and start a span, using current context span as parent.
 */
const createSpan = (
  name: string,
  meta?: ISpanMeta,
  payload?: Record<string, unknown>,
  parentSpan?: ISpan
): ISpan => {
  const parent = parentSpan ?? getCurrentSpan();
  if (parent) {
    const child = parent.child({ name, payload, meta });
    child.start();
    return child;
  }
  return tracer.startSpan(name, payload, meta);
};

/**
 * HOF that wraps a function with span tracing.
 * Parent span is automatically inherited from async context.
 *
 * @example
 * const fetchUser = traced(async (id: string) => api.get(`/users/${id}`), {
 *   name: "fetchUser",
 * });
 *
 * runInSpan(async () => {
 *   await fetchUser("123"); // child of parent
 * }, { name: "parent" });
 */
export function traced<T extends AnyFn>(fn: T, options: TracedOptions): T {
  const wrapped = function (this: any, ...args: Parameters<T>): ReturnType<T> {
    const { name, meta, payload, parentSpan } = options;
    const span = createSpan(name, meta, payload, parentSpan);
    return runWithSpan(span, () =>
      executeWithSpan(span, () => fn.apply(this, args))
    );
  };

  return wrapped as T;
}

/**
 * Method decorator that wraps method with span tracing.
 * Parent span is automatically inherited from async context.
 *
 * @example
 * class UserService {
 *   @Traced("getUser")
 *   async getUser(id: string) {
 *     return this.repo.findById(id);
 *   }
 * }
 */
export const Traced = createTracedDecorator(traced);

/**
 * Run a function within a new span context.
 * The span becomes the current span for all nested calls.
 *
 * @example
 * const result = await runInSpan(async () => {
 *   // getCurrentSpan() returns this span
 *   // Any traced() calls here will be children
 *   return await doWork();
 * }, { name: "operation", meta: { color: "primary" } });
 */
export function runInSpan<T>(
  fn: (span: ISpan) => T,
  options: TracedOptions
): T {
  const span = createSpan(
    options.name,
    options.meta,
    options.payload,
    options.parentSpan
  );
  return runWithSpan(span, () => executeWithSpan(span, () => fn(span)));
}
