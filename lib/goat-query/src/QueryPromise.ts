const QUERY_PROMISE_SYMBOL = Symbol();

export interface IdleQueryPromise<TData> {
  __$type: typeof QUERY_PROMISE_SYMBOL;
  status: "fulfilled" | "rejected";
  value: undefined | TData;
  dataUpdatedAt: undefined | number;
  fetchStatus: "idle";
  reason: unknown;
  errorUpdatedAt: undefined | number;
  readonly _promise: Promise<TData>;
  then<TResult1 = TData, TResult2 = never>(
    onfulfilled?: ((value: TData) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<TData | TResult>;
  finally(onfinally?: (() => void) | null): Promise<TData>;
  readonly [Symbol.toStringTag]: string;
}

export interface PendingQueryPromise<TData> {
  __$type: typeof QUERY_PROMISE_SYMBOL;
  status: "pending";
  value: undefined | TData;
  dataUpdatedAt: undefined | number;
  fetchStatus: "fetching";
  reason: unknown;
  errorUpdatedAt: undefined | number;
  readonly _promise: Promise<TData>;
  then<TResult1 = TData, TResult2 = never>(
    onfulfilled?: ((value: TData) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<TData | TResult>;
  finally(onfinally?: (() => void) | null): Promise<TData>;
  readonly [Symbol.toStringTag]: string;
}

export interface FulfilledQueryPromise<TData> {
  __$type: typeof QUERY_PROMISE_SYMBOL;
  status: "fulfilled";
  value: TData;
  dataUpdatedAt: number;
  fetchStatus: "idle";
  reason: never;
  errorUpdatedAt: never;
  readonly _promise: Promise<TData>;
  then<TResult1 = TData, TResult2 = never>(
    onfulfilled?: ((value: TData) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<TData | TResult>;
  finally(onfinally?: (() => void) | null): Promise<TData>;
  readonly [Symbol.toStringTag]: string;
}

export interface RejectedQueryPromise {
  __$type: typeof QUERY_PROMISE_SYMBOL;
  status: "rejected";
  value: never;
  dataUpdatedAt: number;
  fetchStatus: "idle";
  reason: unknown;
  errorUpdatedAt: number;
  readonly _promise: Promise<never>;
  then<TResult1 = never, TResult2 = never>(
    onfulfilled?: ((value: never) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<TResult>;
  finally(onfinally?: (() => void) | null): Promise<never>;
  readonly [Symbol.toStringTag]: string;
}

export class QueryPromise<TData> implements PromiseLike<TData> {
  __$type = QUERY_PROMISE_SYMBOL;
  status: "pending" | "fulfilled" | "rejected";
  value: TData | undefined;
  dataUpdatedAt: number | undefined;
  fetchStatus: "idle" | "fetching";
  reason: unknown;
  errorUpdatedAt: number | undefined;

  /** @internal */
  readonly _promise: Promise<TData>;

  constructor(
    callback: (
      resolve: (value: TData | PromiseLike<TData>) => void,
      reject: (error: unknown) => void,
    ) => void,
  ) {
    this.status = "pending";
    this.value = undefined;
    this.dataUpdatedAt = undefined;
    this.fetchStatus = "idle";
    this.reason = undefined;
    this.errorUpdatedAt = undefined;

    this._promise = new Promise<TData>(callback);

    // Set up handlers to track promise state
    this._promise.then(
      (value) => {
        this.status = "fulfilled";
        this.value = value;
        this.dataUpdatedAt = Date.now();
        this.fetchStatus = "idle";
        this.reason = undefined;
        this.errorUpdatedAt = undefined;
        return value;
      },
      (reason) => {
        this.status = "rejected";
        this.value = undefined;
        this.dataUpdatedAt = undefined;
        this.fetchStatus = "idle";
        this.reason = reason;
        this.errorUpdatedAt = Date.now();
        throw reason;
      },
    );
  }

  // oxlint-disable-next-line unicorn/no-thenable
  then<TResult1 = TData, TResult2 = never>(
    onfulfilled?: ((value: TData) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this._promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<TData | TResult> {
    return this._promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<TData> {
    return this._promise.finally(onfinally);
  }

  get [Symbol.toStringTag]() {
    return "QueryPromise";
  }
}
