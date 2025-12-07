import type {
  Context,
  MutationDefinition,
  OptimisticUpdateTarget,
  QueryDefinition,
} from "./DependencyGraph";
import { eventEmitter } from "./EventEmitter";
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
    queryDefinition: QueryDefinition<unknown, unknown>,
    parentScopeId?: string
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
    parentScopeId: string
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
    parentScopeId: string
  ) => QueryPromise<TResult> {
    return (params: TParams, parentScopeId: string) => {
      const executionScope = eventEmitter.createScope({ parentScopeId });
      return this.retrier.execute(() => {
        return this.mutationDefinition.config
          .mutationFn(params, this.environment.context)
          .then(async (result) => {
            executionScope.emit("mutation:execution:success", {
              variables: { params },
              data: result,
            });
            await this.invalidateDependencies(
              params,
              result,
              executionScope.scopeId
            );
            return result;
          })
          .catch((error) => {
            executionScope.emit("mutation:execution:error", {
              variables: { params },
              error,
            });
            throw error;
          })
          .finally(() => {
            this.retrier.pause();
          });
      }, QueryPromise) as QueryPromise<TResult>;
    };
  }

  mutate(params: TParams): QueryPromise<TResult> {
    const scope = eventEmitter.createScope();
    scope.emit("mutation:start", { variables: { params } });
    const executionScope = scope.createChildScope();
    executionScope.emit("mutation:execution:start", {
      variables: { params },
    });

    this.applyOptimisticUpdates(params, executionScope.scopeId);
    this.retrier.resume();

    return this.mutationFn(params, executionScope.scopeId);
  }

  private async invalidateDependencies(
    params: TParams,
    result: TResult,
    parentScopeId: string
  ): Promise<void> {
    const scope = eventEmitter.createScope({ parentScopeId });
    const invalidations = this.mutationDefinition.config.invalidates;
    let invalidationTargets: QueryDefinition<any, any>[] = [];
    if (invalidations) {
      for (const invalidation of invalidations) {
        if (typeof invalidation === "function") {
          invalidationTargets.push(...invalidation(params, result));
        } else {
          invalidationTargets.push(invalidation);
        }
      }

      const invalidationScope = scope.createChildScope();
      const queries = invalidationTargets.map((idx) => `query:${idx}`);
      invalidationScope.emit("mutation:invalidation:start", {
        variables: { params },
        queries,
      });

      await Promise.all(
        invalidationTargets.map((queryDef) =>
          this.environment.invalidate(queryDef, invalidationScope.scopeId)
        )
      );

      invalidationScope.emit("mutation:invalidation:success", {
        variables: { params },
        queries,
      });
    }
  }

  private applyOptimisticUpdates(params: TParams, parentScopeId: string): void {
    const optimisticScope = eventEmitter.createScope({ parentScopeId });
    optimisticScope.emit("mutation:optimistic:start", {
      variables: { params },
    });

    const optimisticUpdates = this.mutationDefinition.config.optimistic;
    const ctx = this.environment.context;
    if (optimisticUpdates) {
      for (const optimisticUpdate of optimisticUpdates(params, ctx)) {
        try {
          optimisticScope.emit("mutation:optimistic:update", {
            variables: { params },
            optimisticUpdate,
          });
        } catch (error) {
          optimisticScope.emit("mutation:optimistic:error", {
            variables: { params },
            error,
          });
        } finally {
          optimisticScope.emit("mutation:optimistic:update:done", {
            variables: { params },
            optimisticUpdate,
          });
        }
      }
    }
    optimisticScope.emit("mutation:optimistic:done", {
      variables: { params },
    });
  }
}
