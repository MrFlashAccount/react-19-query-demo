import type {
  Context,
  MutationDefinition,
  OptimisticUpdateTarget,
  IInvalidatable,
} from "./nodes/mutation";
import { tracer, tracePromise, type ISpan } from "lib/tracing";
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
    parentSpan?: ISpan
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
  private mutationFn: (params: TParams) => QueryPromise<TResult>;

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

  private createMutationFn(): (params: TParams) => QueryPromise<TResult> {
    return (params: TParams) => {
      // Create the main execution span
      const span = tracer.startSpan(
        "⚛️ Mutation: Execute",
        { key: params, variables: params },
        { color: "primary" }
      );

      this.applyOptimisticUpdates(params, span);

      return this.retrier.execute(({ attempt }) => {
        const mutateSpan = span.child({
          name: `🏃 Mutation: Mutate (Attempt ${attempt})`,
          payload: { variables: params, attempt },
          meta: { color: "secondary" },
        });

        const mutationPromise = this.mutationDefinition.config
          .mutationFn(params, this.environment.context)
          .then(async (result) => {
            await this.invalidateDependencies(params, result, mutateSpan);
            return result;
          })
          .finally(() => {
            this.retrier.pause();
          });

        // tracePromise handles success/error for both spans
        return tracePromise(mutationPromise, mutateSpan).then(
          (result) => {
            span.success({ data: result });
            return result;
          },
          (error) => {
            span.error(error);
            throw error;
          }
        );
      }, QueryPromise) as QueryPromise<TResult>;
    };
  }

  mutate(params: TParams): QueryPromise<TResult> {
    this.retrier.resume();
    return this.mutationFn(params);
  }

  private async invalidateDependencies(
    params: TParams,
    result: TResult,
    parentSpan: ISpan
  ): Promise<void> {
    const invalidations = this.mutationDefinition.config.invalidates;
    if (!invalidations) return;

    const invalidationTargets: IInvalidatable[] = [];

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
    const span = parentSpan.child({
      name: "🔄 Mutation: Invalidate",
      payload: { variables: params, queries },
      meta: { color: "tertiary" },
    });

    await tracePromise(
      Promise.all(
        invalidationTargets.map((queryDef) =>
          this.environment.invalidate(queryDef, span)
        )
      ),
      span
    );
  }

  private applyOptimisticUpdates(params: TParams, parentSpan: ISpan): void {
    const optimisticUpdates = this.mutationDefinition.config.optimistic;
    if (!optimisticUpdates) return;

    // Create child span for optimistic updates
    const span = parentSpan.child({
      name: "🤞 Apply Optimistic Updates",
      payload: { variables: params },
      meta: { color: "tertiary" },
    });

    const ctx = this.environment.context;

    try {
      for (const optimisticUpdate of optimisticUpdates(params, ctx)) {
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
