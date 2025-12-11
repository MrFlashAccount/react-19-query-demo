import { noop, noopcb } from "./utils";

export type Listener<T> = (payload: T) => void;

export interface CreateScopeOptions {
  parentScopeId?: string;
}

export interface ScopedEmitter<EventMap extends Record<string, any>> {
  scopeId: string;
  parentScopeId?: string;
  emit<K extends keyof EventMap>(
    key: K,
    payload: Omit<EventMap[K], "scopeId">
  ): void;
  createChildScope(
    options?: Omit<CreateScopeOptions, "parentScopeId"> & {
      parentScopeId?: string;
    }
  ): ScopedEmitter<EventMap>;
}

export interface ScopeEvent {
  scopeId: string;
  parentScopeId?: string;
  eventName: string;
  payload: any;
}

export interface ScopeSubscription {
  scopeId: string;
  unsubscribe: () => void;
}

interface EventEmitterBase {
  on<K extends keyof EventsMap>(
    key: K,
    listener: Listener<EventsMap[K]>
  ): () => void;
  off<K extends keyof EventsMap>(
    key: K,
    listener: Listener<EventsMap[K]>
  ): void;
  emit<K extends keyof EventsMap>(key: K, payload: EventsMap[K]): void;
  createScope(options?: CreateScopeOptions): ScopedEmitter<EventsMap>;
  onScope(listener: Listener<ScopeEvent>): () => void;
  onScopeStart(
    handler: (
      scopeId: string,
      subscribeToScope: (listener: (event: ScopeEvent) => void) => () => void,
      firstEvent: ScopeEvent
    ) => void
  ): () => void;
}

function eventEmitterFactory<
  EventMap extends Record<string, any>
>(): EventEmitterBase {
  const listeners: Partial<Record<keyof EventMap, Set<Listener<any>>>> = {};
  const scopeListeners: Set<Listener<ScopeEvent>> = new Set();
  const scopeSubscribers: Map<
    string,
    Set<(event: ScopeEvent) => void>
  > = new Map();
  const scopeParents: Map<string, string | undefined> = new Map();

  function hasListeners(): boolean {
    return scopeListeners.size > 0 || scopeSubscribers.size > 0;
  }

  function on<K extends keyof EventMap>(
    key: K,
    listener: Listener<EventMap[K]>
  ): () => void {
    if (!listeners[key]) {
      listeners[key] = new Set();
    }
    listeners[key]!.add(listener);

    return () => {
      off(key, listener);
    };
  }

  function off<K extends keyof EventMap>(
    key: K,
    listener: Listener<EventMap[K]>
  ): void {
    listeners[key]?.delete(listener);
  }

  function emit<K extends keyof EventMap>(key: K, payload: EventMap[K]): void {
    if (!hasListeners()) {
      return;
    }

    listeners[key]?.forEach((listener) => listener(payload));

    // Also emit to scope listeners if scopeId is present
    if (payload && typeof payload === "object" && "scopeId" in payload) {
      const scopeId = (payload as any).scopeId;
      const parentScopeId = scopeParents.get(scopeId);
      const scopeEvent: ScopeEvent = {
        scopeId,
        parentScopeId,
        eventName: key as string,
        payload,
      };

      // Emit to global scope listeners
      scopeListeners.forEach((listener) => listener(scopeEvent));

      // Emit to scope-specific subscribers
      const scopeSpecificListeners = scopeSubscribers.get(scopeId);
      if (scopeSpecificListeners) {
        scopeSpecificListeners.forEach((listener) => listener(scopeEvent));
      }
    }
  }

  function createScope(
    options: CreateScopeOptions = {}
  ): ScopedEmitter<EventMap> {
    const scopeId = generateScopeId();
    scopeParents.set(scopeId, options.parentScopeId);

    const createScopedEmitter = (
      id: string,
      parentScopeId?: string
    ): ScopedEmitter<EventMap> => {
      return {
        scopeId: id,
        parentScopeId,
        emit: <K extends keyof EventMap>(
          key: K,
          payload: Omit<EventMap[K], "scopeId">
        ) => {
          emit(key, { ...payload, scopeId: id } as EventMap[K]);
        },
        createChildScope: (
          childOptions: Omit<CreateScopeOptions, "parentScopeId"> & {
            parentScopeId?: string;
          } = {}
        ) =>
          createScope({
            parentScopeId: childOptions.parentScopeId ?? id,
          }),
      };
    };

    return createScopedEmitter(scopeId, options.parentScopeId);
  }

  /**
   * Subscribe to all events across all scopes
   */
  function onScope(listener: Listener<ScopeEvent>): () => void {
    scopeListeners.add(listener);
    return () => {
      scopeListeners.delete(listener);
    };
  }

  /**
   * Listen for events and subscribe to a specific scope when it arrives.
   * Returns a function that accepts a callback to handle scope subscription.
   *
   * @example
   * ```typescript
   * const unsubscribe = eventEmitter.onScopeStart((scopeId, subscribeToScope) => {
   *   console.log('New scope started:', scopeId);
   *
   *   // Subscribe to all events in this scope
   *   const unsubscribeScope = subscribeToScope((event) => {
   *     console.log(`[${scopeId}] ${event.eventName}`, event.payload);
   *
   *     // Check if scope is done
   *     if (event.eventName.endsWith(':success') || event.eventName.endsWith(':error')) {
   *       console.log('Scope completed');
   *       unsubscribeScope(); // Optionally unsubscribe
   *     }
   *   });
   * });
   * ```
   */
  function onScopeStart(
    handler: (
      scopeId: string,
      subscribeToScope: (listener: (event: ScopeEvent) => void) => () => void,
      firstEvent: ScopeEvent
    ) => void
  ): () => void {
    const activeScopeIds = new Set<string>();

    const scopeListener = (event: ScopeEvent) => {
      // Check if this is the first event in this scope
      if (!activeScopeIds.has(event.scopeId)) {
        activeScopeIds.add(event.scopeId);

        // Create a subscription function for this specific scope
        const subscribeToScope = (listener: (event: ScopeEvent) => void) => {
          // Create a Set for this scope if it doesn't exist
          if (!scopeSubscribers.has(event.scopeId)) {
            scopeSubscribers.set(event.scopeId, new Set());
          }

          const scopeSpecificListeners = scopeSubscribers.get(event.scopeId)!;
          scopeSpecificListeners.add(listener);

          // Return unsubscribe function
          return () => {
            scopeSpecificListeners.delete(listener);
            // Clean up empty sets
            if (scopeSpecificListeners.size === 0) {
              scopeSubscribers.delete(event.scopeId);
              activeScopeIds.delete(event.scopeId);
              scopeParents.delete(event.scopeId);
            }
          };
        };

        // Call the handler with scopeId, subscribe function, and first event
        handler(event.scopeId, subscribeToScope, event);
      }
    };

    scopeListeners.add(scopeListener);

    // Return cleanup function
    return () => {
      scopeListeners.delete(scopeListener);
      activeScopeIds.clear();
    };
  }

  return {
    on,
    off,
    emit,
    createScope,
    onScope,
    onScopeStart,
  };
}

export interface EventsMap {
  // Global events
  "global:start": { scopeId: string };
  "global:success": { scopeId: string };
  "global:error": { scopeId: string; error: unknown };
  // QueryClient events
  "queries:invalidation:start": { queries: string[]; scopeId: string };
  "queries:invalidation:success": { queries: string[]; scopeId: string };
  "queries:invalidation:error": {
    queries: string[];
    error: unknown;
    scopeId: string;
  };
  // Query events
  "query:fetch:start": { key: string; scopeId: string };
  "query:fetch:success": { key: string; scopeId: string };
  "query:fetch:error": {
    key: string;
    error: unknown;
    scopeId: string;
  };
  "query:stale": { key: string };

  "query:prefetch:start": { key: string; scopeId: string };
  "query:prefetch:success": { key: string; scopeId: string };
  "query:prefetch:error": {
    key: string;
    error: unknown;
    scopeId: string;
  };

  "query:garbage-collect": { key: string };

  // Mutation events
  "mutation:execution:start": { variables: unknown; scopeId: string };
  "mutation:execution:success": {
    variables: unknown;
    data: unknown;
    scopeId: string;
  };
  "mutation:execution:error": {
    variables: unknown;
    error: unknown;
    scopeId: string;
  };

  "mutation:invalidation:start": {
    variables: unknown;
    queries: string[];
    scopeId: string;
  };
  "mutation:invalidation:success": {
    variables: unknown;
    queries: string[];
    scopeId: string;
  };
  "mutation:invalidation:error": {
    variables: unknown;
    queries: string[];
    error: unknown;
    scopeId: string;
  };
  "mutation:notify:start": { scopeId: string };
  "mutation:notify:success": { scopeId: string };
  "mutation:optimistic:start": { variables: unknown; scopeId: string };
  "mutation:optimistic:update": {
    variables: unknown;
    optimisticUpdate: unknown;
    scopeId: string;
  };
  "mutation:optimistic:update:done": {
    variables: unknown;
    optimisticUpdate: unknown;
    scopeId: string;
  };
  "mutation:optimistic:error": {
    variables: unknown;
    error: unknown;
    scopeId: string;
  };
  "mutation:optimistic:done": { variables: unknown; scopeId: string };

  // QueryClient events
  "client:change": { client: any };
}
function nullEmitterFactory<
  EventMap extends Record<string, any>
>(): EventEmitterBase {
  function createScope(): ScopedEmitter<EventMap> {
    return {
      scopeId: "",
      parentScopeId: undefined,
      emit: noop,
      createChildScope: createScope,
    };
  }
  return {
    on: noopcb,
    off: noop,
    emit: noop,
    createScope,
    onScope: noopcb,
    onScopeStart: noopcb,
  };
}

export const eventEmitter = import.meta.env.DEV
  ? eventEmitterFactory<EventsMap>()
  : nullEmitterFactory<EventsMap>();

function generateScopeId(): string {
  return `${Math.random().toString(36)}-${Date.now().toString(36)}`;
}
