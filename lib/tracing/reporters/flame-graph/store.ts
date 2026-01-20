import { Batcher } from "../../Batcher";
import { addEventListener } from "./utilities";

type SetStateAction<T> = Partial<T> | ((state: T) => Partial<T>);
type StateListener<T> = (state: T, prevState: T) => void;
type Selector<T, U> = (state: T) => U;
type EqualityFn<T> = (a: T, b: T) => boolean;

export interface SubscribeOptions<U> {
  equalityFn?: EqualityFn<U>;
  fireImmediately?: boolean;
  signal?: AbortSignal;
}

export interface StoreApi<T> {
  getState: () => T;
  setState: (action: SetStateAction<T>, replace?: boolean) => void;
  subscribe: {
    (
      listener: StateListener<T>,
      options?: { signal?: AbortSignal }
    ): () => void;
    <U>(
      selector: Selector<T, U>,
      listener: (selected: U, prevSelected: U) => void,
      options?: SubscribeOptions<U>
    ): () => void;
  };
  getInitialState: () => T;
  destroy: () => void;
}

export type StateCreator<T> = (
  set: StoreApi<T>["setState"],
  get: StoreApi<T>["getState"],
  api: StoreApi<T>
) => T;

const defaultEqualityFn = <T>(a: T, b: T): boolean => {
  if (a === b) return true;
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || b.get(k) !== v) return false;
    }
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a === b;
  }
  if (typeof a === "object" && typeof b === "object" && a && b) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (k) =>
        (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]
    );
  }
  return false;
};

const unsetSymbol = Symbol("unset");

export function createStore<T extends Record<string, unknown>>(
  initialState: T | StateCreator<T>
): StoreApi<T> {
  const listeners = new Set<StateListener<T>>();
  let state: T;
  let prevState: T | typeof unsetSymbol = unsetSymbol;
  let initialStateValue: T;
  const batcher = new Batcher<void>({
    process: () => {
      if (prevState === unsetSymbol) {
        throw new Error("prevState is null");
      }
      for (const listener of listeners) {
        listener(state, prevState);
      }
      prevState = unsetSymbol;
    },
    scheduler: "microtask",
  });

  const getState = () => state;
  const getInitialState = () => initialStateValue;

  const setState: StoreApi<T>["setState"] = (action, replace) => {
    const prevStateCopy = state;
    const partial = typeof action === "function" ? action(state) : action;

    // Check if anything actually changed
    const hasChanged = Object.keys(partial).some(
      (key) =>
        !defaultEqualityFn(
          partial[key as keyof T],
          prevStateCopy[key as keyof T]
        )
    );

    if (!hasChanged) return;

    state = replace ? (partial as T) : { ...state, ...partial };
    if (prevState === unsetSymbol) {
      prevState = prevStateCopy;
      batcher.flush({ force: true });
    }
  };

  // Overloaded subscribe: full state or with selector
  const subscribe: StoreApi<T>["subscribe"] = <U>(
    listenerOrSelector: StateListener<T> | Selector<T, U>,
    maybeListenerOrOptions?:
      | ((selected: U, prevSelected: U) => void)
      | SubscribeOptions<U>,
    options: SubscribeOptions<U> = {}
  ): (() => void) => {
    // Selector + listener case: second arg is a function
    if (typeof maybeListenerOrOptions === "function") {
      const selector = listenerOrSelector as Selector<T, U>;
      const listener = maybeListenerOrOptions;
      const equalityFn = options.equalityFn ?? defaultEqualityFn;
      const defaultController = new AbortController();
      const signal = options.signal ?? defaultController.signal;

      let currentSlice = selector(state);

      if (options.fireImmediately) {
        listener(currentSlice, currentSlice);
      }

      const wrappedListener: StateListener<T> = (nextState, prevState) => {
        const nextSlice = selector(nextState);
        const prevSlice = selector(prevState);

        if (!equalityFn(nextSlice, prevSlice)) {
          const prev = currentSlice;
          currentSlice = nextSlice;
          listener(nextSlice, prev);
        }
      };

      listeners.add(wrappedListener);
      const cleanups = [
        addEventListener(signal, "abort", () => {
          listeners.delete(wrappedListener);
          cleanups.forEach((cleanup) => cleanup());
        }),
        addEventListener(defaultController.signal, "abort", () => {
          listeners.delete(wrappedListener);
          cleanups.forEach((cleanup) => cleanup());
        }),
      ];
      return () => {
        defaultController.abort();
        cleanups.forEach((cleanup) => cleanup());
      };
    }

    // Simple listener case: no selector
    const listener = listenerOrSelector as StateListener<T>;
    const defaultController = new AbortController();
    const signal = options.signal ?? defaultController.signal;
    listeners.add(listener);
    const cleanup = addEventListener(signal, "abort", () => {
      listeners.delete(listener);
      cleanup();
    });

    return () => {
      defaultController.abort();
      cleanup();
    };
  };

  const destroy = () => listeners.clear();

  const api: StoreApi<T> = {
    getState,
    setState,
    subscribe,
    getInitialState,
    destroy,
  };

  // Initialize state
  if (typeof initialState === "function") {
    state = initialState(setState, getState, api);
    initialStateValue = { ...state };
  } else {
    state = { ...initialState };
    initialStateValue = { ...initialState };
  }

  return api;
}

// Selector helpers
export const shallow = <T>(a: T, b: T): boolean => defaultEqualityFn(a, b);
