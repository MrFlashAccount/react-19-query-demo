/**
 * Shared utilities for tracing helpers.
 * Used by helpers.ts, asynccontext.ts, and node.ts.
 */

import type { ISpan, ISpanMeta } from "./types";

export type AnyFn = (...args: any[]) => any;

export type TracedOptions = {
  name: string;
  meta?: ISpanMeta;
  payload?: Record<string, unknown>;
  parentSpan?: ISpan;
};

/**
 * Execute a function within a span, handling sync/async and success/error.
 */
export function executeWithSpan<T>(span: ISpan, fn: (span: ISpan) => T): T {
  try {
    const result = fn(span);

    if (isPromiseLike<T>(result)) {
      return result.then(
        (val) => {
          span.success();
          return val;
        },
        (err) => {
          span.error(err);
          throw err;
        }
      ) as T;
    }

    span.success();
    return result;
  } catch (err) {
    span.error(err);
    throw err;
  }
}

/**
 * Create a Traced decorator from a traced HOF.
 */
export function createTracedDecorator(
  tracedFn: <T extends AnyFn>(fn: T, options: TracedOptions) => AnyFn
) {
  return function Traced(name: string, meta?: any): MethodDecorator {
    return function (
      _target: any,
      _propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ) {
      const original = descriptor.value as AnyFn;
      descriptor.value = tracedFn(original, { name, meta }) as AnyFn;
      return descriptor;
    };
  };
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return (
    value !== null &&
    typeof value === "object" &&
    "then" in value &&
    typeof (value as PromiseLike<T>).then === "function"
  );
}
