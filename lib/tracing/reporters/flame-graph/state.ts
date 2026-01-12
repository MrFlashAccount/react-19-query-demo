import type { SpanId } from "../../types";
import type { FlameGraphSpan, TimeRange } from "./types";
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

export function createStore<T extends Record<string, unknown>>(
  initialState: T | StateCreator<T>
): StoreApi<T> {
  const listeners = new Set<StateListener<T>>();
  let state: T;
  let initialStateValue: T;

  const getState = () => state;
  const getInitialState = () => initialStateValue;

  const setState: StoreApi<T>["setState"] = (action, replace) => {
    const prevState = state;
    const partial = typeof action === "function" ? action(state) : action;

    // Check if anything actually changed
    const hasChanged = Object.keys(partial).some(
      (key) =>
        !defaultEqualityFn(partial[key as keyof T], prevState[key as keyof T])
    );

    if (!hasChanged) return;

    state = replace ? (partial as T) : { ...state, ...partial };

    for (const listener of listeners) {
      listener(state, prevState);
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

export interface FlameGraphViewState {
  offsetX: number;
  offsetY: number;
  zoom: number;
  isOpen: boolean;
  isPipMode: boolean;
  height: number;
  detailsPanel: {
    position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
    open: boolean;
    height: number;
    width: number;
  };
  canvas: {
    width: number;
    height: number;
  };
}

export interface FlameGraphState extends Record<string, unknown> {
  spans: FlameGraphSpan[];
  pendingSpans: Map<string, Partial<FlameGraphSpan>>;
  selectedSpanId: SpanId | null;
  timeRange: TimeRange;
  viewState: FlameGraphViewState;
  isRecording: boolean;
  isOpen: boolean;
  isPipMode: boolean;
  height: number;
}

const INITIAL_STATE: FlameGraphState = {
  spans: [],
  pendingSpans: new Map(),
  selectedSpanId: null,
  timeRange: { minTime: 0, maxTime: 0 },
  viewState: {
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
    isOpen: false,
    isPipMode: false,
    height: 350,
    detailsPanel: {
      position: "bottom-right",
      open: false,
      height: 100,
      width: 100,
    },
    canvas: { width: 1000, height: 1000 },
  },
  isRecording: false,
  isOpen: false,
  isPipMode: false,
  height: 350,
};

export const selectors = {
  spans: (s: FlameGraphState) => s.spans,
  pendingSpans: (s: FlameGraphState) => s.pendingSpans,
  selectedSpanId: (s: FlameGraphState) => s.selectedSpanId,
  timeRange: (s: FlameGraphState) => s.timeRange,
  viewState: (s: FlameGraphState) => s.viewState,
  isRecording: (s: FlameGraphState) => s.isRecording,
  isOpen: (s: FlameGraphState) => s.isOpen,
  isPipMode: (s: FlameGraphState) => s.isPipMode,
  height: (s: FlameGraphState) => s.height,
  zoom: (s: FlameGraphState) => s.viewState.zoom,
  zoomPercent: (s: FlameGraphState) => Math.round(s.viewState.zoom * 100),
  spanCount: (s: FlameGraphState) => s.spans.length + s.pendingSpans.size,
  hasSpans: (s: FlameGraphState) => s.spans.length + s.pendingSpans.size > 0,
  maxDepth: (s: FlameGraphState) => {
    let max = 0;
    for (const span of s.spans) {
      if (span.depth > max) max = span.depth;
    }
    for (const [, pending] of s.pendingSpans) {
      if (pending.depth !== undefined && pending.depth > max) {
        max = pending.depth;
      }
    }
    return max;
  },
} as const;

function createActions(store: StoreApi<FlameGraphState>) {
  const { getState, setState } = store;

  return {
    // Spans
    addSpan(span: FlameGraphSpan) {
      setState((s) => ({ spans: [...s.spans, span] }));
    },

    addPendingSpan(spanId: string, partial: Partial<FlameGraphSpan>) {
      setState((s) => {
        const next = new Map(s.pendingSpans);
        next.set(spanId, partial);
        return { pendingSpans: next };
      });
    },

    updatePendingSpan(spanId: string, partial: Partial<FlameGraphSpan>) {
      const { pendingSpans } = getState();
      const existing = pendingSpans.get(spanId);
      if (!existing) return;
      const next = new Map(pendingSpans);
      next.set(spanId, { ...existing, ...partial });
      setState({ pendingSpans: next });
    },

    completePendingSpan(spanId: string, span: FlameGraphSpan) {
      setState((s) => {
        const next = new Map(s.pendingSpans);
        next.delete(spanId);
        return { pendingSpans: next, spans: [...s.spans, span] };
      });
    },

    removePendingSpan(spanId: string) {
      const { pendingSpans } = getState();
      if (!pendingSpans.has(spanId)) return;
      const next = new Map(pendingSpans);
      next.delete(spanId);
      setState({ pendingSpans: next });
    },

    // Selection
    selectSpan(spanId: SpanId | null) {
      setState({ selectedSpanId: spanId });
    },

    // View
    setViewState(viewState: Partial<FlameGraphViewState>) {
      setState((s) => ({
        viewState: { ...s.viewState, ...viewState },
      }));
    },

    setTimeRange(timeRange: TimeRange) {
      setState({ timeRange });
    },

    setHeight(height: number) {
      setState({ height });
    },

    // Recording
    startRecording() {
      setState({ ...INITIAL_STATE, isRecording: true });
    },

    stopRecording() {
      setState({ isRecording: false });
    },

    toggleRecording(): boolean {
      const next = !getState().isRecording;
      if (next) {
        setState({ ...INITIAL_STATE, isRecording: true });
      } else {
        setState({ isRecording: false });
      }
      return next;
    },

    // Dialog
    open() {
      setState({ isOpen: true });
    },

    close() {
      setState({ isOpen: false, isPipMode: false });
    },

    // PiP
    enterPip() {
      setState({ isPipMode: true });
    },

    exitPip() {
      setState({ isPipMode: false });
    },

    // Reset
    clear() {
      setState(INITIAL_STATE);
    },

    reset() {
      setState(store.getInitialState(), true);
    },
  };
}

const store = createStore(() => INITIAL_STATE);
const actions = createActions(store);

// Public API: store + actions + selectors
export const flameGraphState = {
  getState: store.getState,
  subscribe: store.subscribe,
  ...actions,
  selectors,
};
