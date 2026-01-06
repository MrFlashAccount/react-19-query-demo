import type { FlameGraphSpan, TimeRange, ViewState } from "./types";

type Listener<V> = (value: V) => void;

export class Store<T extends object> {
  private state: T;
  private listeners = new Map<string, Set<Listener<unknown>>>();

  constructor(private defaultState: T) {
    this.state = { ...defaultState };
  }

  // Get value at dot path (e.g., "viewState.zoom")
  get<V = unknown>(path: string): V {
    return this.getAtPath(this.state, path) as V;
  }

  // Get top-level key with type safety
  getKey<K extends keyof T>(key: K): T[K] {
    return this.state[key];
  }

  getSnapshot(): Readonly<T> {
    return this.state;
  }

  // Set value at path
  set(path: string, value: unknown): void {
    const prev = this.getAtPath(this.state, path);
    if (this.isEqual(prev, value)) return;

    this.state = this.setAtPath(this.state, path, value);
    this.notifyPath(path, value, prev);
  }

  // Set top-level key (optimized, type-safe)
  setKey<K extends keyof T>(key: K, value: T[K]): void {
    const prev = this.state[key];
    if (this.isEqual(prev, value)) return;

    this.state = { ...this.state, [key]: value };
    this.notifyPath(key as string, value, prev);
  }

  // Batch update multiple top-level properties
  update(partial: Partial<T>): void {
    const changed: Array<{ key: string; value: unknown; prev: unknown }> = [];

    for (const key of Object.keys(partial)) {
      const value = partial[key as keyof T];
      const prev = this.state[key as keyof T];
      if (!this.isEqual(prev, value)) {
        changed.push({ key, value, prev });
      }
    }

    if (changed.length === 0) return;

    this.state = { ...this.state, ...partial };
    for (const { key, value, prev } of changed) {
      this.notifyPath(key, value, prev);
    }
  }

  // Subscribe to path changes (supports deep paths like "viewState.zoom")
  subscribe<V = unknown>(path: string, listener: Listener<V>): () => void {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }

    this.listeners.get(path)!.add(listener as Listener<unknown>);

    return () => {
      this.listeners.get(path)?.delete(listener as Listener<unknown>);
    };
  }

  // Subscribe to multiple paths
  subscribeMany(
    paths: string[],
    listener: (values: Record<string, unknown>) => void
  ): () => void {
    const unsubs = paths.map((path) =>
      this.subscribe(path, () => {
        const values: Record<string, unknown> = {};
        for (const p of paths) {
          values[p] = this.getAtPath(this.state, p);
        }
        listener(values);
      })
    );
    return () => unsubs.forEach((u) => u());
  }

  // Reset to default state
  reset(): void {
    const prev = this.state;
    this.state = { ...this.defaultState };
    for (const key of Object.keys(prev)) {
      const k = key as keyof T;
      if (!this.isEqual(prev[k], this.state[k])) {
        this.notifyPath(key, this.state[k], prev[k]);
      }
    }
  }

  // Internal: get value at dot-separated path
  private getAtPath(obj: unknown, path: string): unknown {
    const keys = path.split(".");
    let current = obj;
    for (const key of keys) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  // Internal: immutable set at path
  private setAtPath<O extends object>(obj: O, path: string, value: unknown): O {
    const keys = path.split(".");
    if (keys.length === 1) {
      return { ...obj, [keys[0]]: value };
    }

    const [first, ...rest] = keys;
    const nested = (obj as Record<string, unknown>)[first];
    return {
      ...obj,
      [first]: this.setAtPath(nested as object, rest.join("."), value),
    };
  }

  // Notify listeners for path and child paths
  private notifyPath(path: string, value: unknown, prev: unknown): void {
    // Notify exact path listeners
    const listeners = this.listeners.get(path);
    if (listeners) {
      for (const listener of listeners) {
        listener(value);
      }
    }

    // Notify child path listeners when parent changes (e.g., "viewState.zoom" when "viewState" changes)
    if (typeof value === "object" && value !== null) {
      for (const [listenerPath, pathListeners] of this.listeners) {
        if (listenerPath.startsWith(path + ".") && pathListeners.size > 0) {
          const suffix = listenerPath.slice(path.length + 1);
          const childValue = this.getAtPath(value, suffix);
          const childPrev = this.getAtPath(prev, suffix);
          if (!this.isEqual(childValue, childPrev)) {
            for (const listener of pathListeners) {
              listener(childValue);
            }
          }
        }
      }
    }
  }

  private isEqual(a: unknown, b: unknown): boolean {
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
          (a as Record<string, unknown>)[k] ===
          (b as Record<string, unknown>)[k]
      );
    }
    return false;
  }
}

export interface FlameGraphState {
  spans: FlameGraphSpan[];
  pendingSpans: Map<string, Partial<FlameGraphSpan>>;
  selectedSpanId: string | null;
  timeRange: TimeRange;
  viewState: ViewState;
  isRecording: boolean;
  isOpen: boolean;
  isPipMode: boolean;
  height: number;
}

const DEFAULT_STATE: FlameGraphState = {
  spans: [],
  pendingSpans: new Map(),
  selectedSpanId: null,
  timeRange: { minTime: 0, maxTime: 0 },
  viewState: { offsetX: 0, offsetY: 0, zoom: 1 },
  isRecording: false,
  isOpen: false,
  isPipMode: false,
  height: 350,
};

class FlameGraphStateManager {
  readonly store = new Store<FlameGraphState>(DEFAULT_STATE);

  // Proxy common store methods
  get = this.store.get.bind(this.store);
  set = this.store.set.bind(this.store);
  subscribe = this.store.subscribe.bind(this.store);
  subscribeMany = this.store.subscribeMany.bind(this.store);
  getSnapshot = this.store.getSnapshot.bind(this.store);

  // === State API ===

  // Spans
  addSpan(span: FlameGraphSpan): void {
    this.store.setKey("spans", [...this.store.getKey("spans"), span]);
  }

  addPendingSpan(spanId: string, partial: Partial<FlameGraphSpan>): void {
    const next = new Map(this.store.getKey("pendingSpans"));
    next.set(spanId, partial);
    this.store.setKey("pendingSpans", next);
  }

  updatePendingSpan(spanId: string, partial: Partial<FlameGraphSpan>): void {
    const pending = this.store.getKey("pendingSpans");
    const existing = pending.get(spanId);
    if (!existing) return;
    const next = new Map(pending);
    next.set(spanId, { ...existing, ...partial });
    this.store.setKey("pendingSpans", next);
  }

  completePendingSpan(spanId: string, span: FlameGraphSpan): void {
    const next = new Map(this.store.getKey("pendingSpans"));
    next.delete(spanId);
    this.store.update({
      pendingSpans: next,
      spans: [...this.store.getKey("spans"), span],
    });
  }

  removePendingSpan(spanId: string): void {
    const pending = this.store.getKey("pendingSpans");
    if (!pending.has(spanId)) return;
    const next = new Map(pending);
    next.delete(spanId);
    this.store.setKey("pendingSpans", next);
  }

  setHeight(height: number): void {
    this.store.setKey("height", height);
  }

  // Selection
  selectSpan(spanId: string | null): void {
    this.store.setKey("selectedSpanId", spanId);
  }

  // View
  setViewState(viewState: ViewState): void {
    this.store.setKey("viewState", viewState);
  }

  setTimeRange(timeRange: TimeRange): void {
    this.store.setKey("timeRange", timeRange);
  }

  // Recording
  startRecording(): void {
    this.clear();
    this.store.setKey("isRecording", true);
  }

  stopRecording(): void {
    this.store.setKey("isRecording", false);
  }

  toggleRecording(): boolean {
    const next = !this.store.getKey("isRecording");
    if (next) {
      this.startRecording();
    } else {
      this.stopRecording();
    }
    return next;
  }

  // Dialog
  open(): void {
    this.store.setKey("isOpen", true);
  }

  close(): void {
    this.store.update({
      isOpen: false,
      isPipMode: false,
    });
  }

  // PiP
  enterPip(): void {
    this.store.setKey("isPipMode", true);
  }

  exitPip(): void {
    this.store.setKey("isPipMode", false);
  }

  // Reset
  clear(): void {
    this.store.update({
      spans: [],
      pendingSpans: new Map(),
      selectedSpanId: null,
      timeRange: { minTime: 0, maxTime: 0 },
      viewState: { offsetX: 0, offsetY: 0, zoom: 1 },
    });
  }

  reset(): void {
    this.store.reset();
  }

  // Computed getters
  get spanCount(): number {
    return (
      this.store.getKey("spans").length + this.store.getKey("pendingSpans").size
    );
  }

  get hasSpans(): boolean {
    return this.spanCount > 0;
  }

  get zoomPercent(): number {
    return Math.round(this.store.getKey("viewState").zoom * 100);
  }

  get maxDepth(): number {
    let max = 0;
    for (const span of this.store.getKey("spans")) {
      if (span.depth > max) max = span.depth;
    }
    for (const [, pending] of this.store.getKey("pendingSpans")) {
      if (pending.depth !== undefined && pending.depth > max) {
        max = pending.depth;
      }
    }
    return max;
  }
}

// Singleton instance
export const flameGraphState = new FlameGraphStateManager();
