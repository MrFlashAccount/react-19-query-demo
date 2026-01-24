import type { ISpan } from "@lib/tracing";

export interface Context {
  [key: string]: unknown;
}

export interface IInvalidatable {
  invalidate(parentSpan?: ISpan): Promise<void>;
  toString(): string;
}

// TODO: Implement optimistic updates
export interface IOptimisticUpdateable {
  applyOptimisticUpdate(): void;
}

export interface ICacheable {
  getCacheKey(): string;
}
