import type {
  Context,
  MutationDefinition,
  OptimisticUpdateTarget,
  IInvalidatable,
} from "./nodes/mutation";
import { tracer, type Span } from "./tracing";
import { Retrier, type RetryConfig } from "./Retrier";
import { exponentialBackoff } from "./utils";
import { QueryPromise } from "./QueryPromise";

export interface MutationState<TResult> {
  promise: QueryPromise<TResult>;
  error: QueryPromise<TResult>["reason"];
  dataUpdatedAt: QueryPromise<TResult>["dataUpdatedAt"];
  fetchStatus: QueryPromise<TResult>["fetchStatus"];
  errorUpdatedAt: QueryPromise<TResult>["errorUpdatedAt"];
  status: QueryPromise<TResult>["status"];
}

interface MutationEnvironment<TParams = unknown> {
  context: Context;
  invalidate: (
    queryDefinition: IInvalidatable,
    parentSpan?: Span
  ) => Promise<void>;
  applyOptimisticUpdates: (
    optimisticUpdate: OptimisticUpdateTarget<TParams, unknown>
  ) => void;
}

export class Mutation<TParams = unknown, TResult = unknown> {
  private mutationDefinition: MutationDefinition<TParams, TResult>;
  private environment: MutationEnvironment;
  private retry: RetryConfig;
  private retryDelay:
    | number
    | ((failureCount: number, error: unknown) => number);
  private retrier: Retrier;
  private mutationFn: (
    params: TParams,
    parentSpan: Span
  ) => QueryPromise<TResult>;

  constructor(
    mutationDefinition: MutationDefinition<TParams, TResult>,
    environment: MutationEnvironment
  ) {
    this.mutationDefinition = mutationDefinition;

    this.environment = environment;

    const config = mutationDefinition.config;
    this.retry = config.retry ?? 0;
    this.retryDelay =
      config.retryDelay ??
      ((failureCount) => exponentialBackoff(1000, failureCount, 10000));

    // Create retrier with options from definition
    this.retrier = new Retrier({
      retry: this.retry,
      retryDelay: this.retryDelay,
    });

    this.retrier.pause();
    this.mutationFn = this.createMutationFn();
  }

  getState(promise: QueryPromise<TResult>): Readonly<MutationState<TResult>> {
    return {
      promise,
      error: promise.reason,
      dataUpdatedAt: promise.dataUpdatedAt,
      fetchStatus: promise.fetchStatus,
      errorUpdatedAt: promise.errorUpdatedAt,
      status: promise.status,
    };
  }

  private createMutationFn(): (
    params: TParams,
    parentSpan: Span
  ) => QueryPromise<TResult> {
    return (params: TParams, parentSpan: Span) => {
      return this.retrier.execute(() => {
        return this.mutationDefinition.config
          .mutationFn(params, this.environment.context)
          .then(async (result) => {
            await this.invalidateDependencies(params, result, parentSpan);
            return result;
          })
          .finally(() => {
            this.retrier.pause();
          });
      }, QueryPromise) as QueryPromise<TResult>;
    };
  }

  mutate(params: TParams): QueryPromise<TResult> {
    // Create the main execution span
    const span = tracer.startSpan("mutation:execute", {
      variables: params,
    });

    this.applyOptimisticUpdates(params, span);
    this.retrier.resume();

    const promise = this.mutationFn(params, span);

    // End span on completion (non-blocking)
    promise
      .then((result) => {
        span.success({ data: result });
      })
      .catch((error) => {
        span.error(error);
      });

    return promise;
  }

  private async invalidateDependencies(
    params: TParams,
    result: TResult,
    parentSpan: Span
  ): Promise<void> {
    const invalidations = this.mutationDefinition.config.invalidates;
    if (!invalidations) return;

    let invalidationTargets: IInvalidatable[] = [];

    for (const invalidation of invalidations) {
      if (typeof invalidation === "function") {
        const targets = invalidation(params, result);
        if (Array.isArray(targets)) {
          invalidationTargets.push(...targets);
        } else {
          invalidationTargets.push(targets);
        }
      } else {
        invalidationTargets.push(invalidation);
      }
    }

    if (invalidationTargets.length === 0) return;

    const queries = invalidationTargets.map((target) => String(target));

    // Create child span for invalidation
    const span = parentSpan.child("mutation:invalidate", {
      variables: params,
      queries,
    });

    try {
      await Promise.all(
        invalidationTargets.map((queryDef) =>
          this.environment.invalidate(queryDef, span)
        )
      );
      span.success({ queries });
    } catch (error) {
      span.error(error, { queries });
      throw error;
    }
  }

  private applyOptimisticUpdates(params: TParams, parentSpan: Span): void {
    const optimisticUpdates = this.mutationDefinition.config.optimistic;
    if (!optimisticUpdates) return;

    // Create child span for optimistic updates
    const span = parentSpan.child("mutation:optimistic", {
      variables: params,
    });

    const ctx = this.environment.context;

    try {
      for (const optimisticUpdate of optimisticUpdates(params, ctx)) {
        span.event("update:applied", { update: optimisticUpdate });
        // Type assertion needed due to generic parameter variance
        this.environment.applyOptimisticUpdates(
          optimisticUpdate as OptimisticUpdateTarget<unknown, unknown>
        );
      }
      span.success();
    } catch (error) {
      span.error(error);
    }
  }
}
