/**
 * Shared utilities for tracing helpers.
 * Used by helpers.ts, asynccontext.ts, and node.ts.
 */

import type { ISpan } from "./types";

export type AnyFn = (...args: any[]) => any;

/**
 * Execute a function within a span, handling sync/async and success/error.
 */
export function executeWithSpan<T>(span: ISpan, fn: (span: ISpan) => T): T {
  try {
    const result = fn(span);

    if (result instanceof Promise) {
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
  tracedFn: <T extends AnyFn>(fn: T, name: string, meta?: any) => T
) {
  return function Traced(name: string, meta?: any): MethodDecorator {
    return function (
      _target: any,
      _propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ) {
      const original = descriptor.value;
      descriptor.value = tracedFn(original, name, meta);
      return descriptor;
    };
  };
}
