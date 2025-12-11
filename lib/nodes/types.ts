import type { Span } from "../tracing";

export interface Context {
  [key: string]: unknown;
}

export interface IInvalidatable {
  invalidate(parentSpan?: Span): Promise<void>;
}

// TODO: Implement optimistic updates
export interface IOptimisticUpdateable {
  applyOptimisticUpdate(): void;
}

export interface ICacheable {
  getCacheKey(): string;
}
