import { generateScopeId } from "./utils";

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

export class EventEmitter<EventMap extends Record<string, any>> {
  private listeners: Partial<Record<keyof EventMap, Set<Listener<any>>>> = {};
  private scopeListeners: Set<Listener<ScopeEvent>> = new Set();
  private scopeSubscribers: Map<string, Set<(event: ScopeEvent) => void>> =
    new Map();
  private scopeParents: Map<string, string | undefined> = new Map();

  on<K extends keyof EventMap>(
    key: K,
    listener: Listener<EventMap[K]>
  ): () => void {
    if (!this.listeners[key]) {
      this.listeners[key] = new Set();
    }
    this.listeners[key]!.add(listener);

    return () => {
      this.off(key, listener);
    };
  }

  off<K extends keyof EventMap>(key: K, listener: Listener<EventMap[K]>): void {
    this.listeners[key]?.delete(listener);
  }

  emit<K extends keyof EventMap>(key: K, payload: EventMap[K]): void {
    if (!this.hasListeners()) {
      return;
    }

    this.listeners[key]?.forEach((listener) => listener(payload));

    // Also emit to scope listeners if scopeId is present
    if (payload && typeof payload === "object" && "scopeId" in payload) {
      const scopeId = (payload as any).scopeId;
      const parentScopeId = this.scopeParents.get(scopeId);
      const scopeEvent: ScopeEvent = {
        scopeId,
        parentScopeId,
        eventName: key as string,
        payload,
      };

      // Emit to global scope listeners
      this.scopeListeners.forEach((listener) => listener(scopeEvent));

      // Emit to scope-specific subscribers
      const scopeListeners = this.scopeSubscribers.get(scopeId);
      if (scopeListeners) {
        scopeListeners.forEach((listener) => listener(scopeEvent));
      }
    }
  }

  createScope(options: CreateScopeOptions = {}): ScopedEmitter<EventMap> {
    const scopeId = generateScopeId();
    this.scopeParents.set(scopeId, options.parentScopeId);

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
          this.emit(key, { ...payload, scopeId: id } as EventMap[K]);
        },
        createChildScope: (
          childOptions: Omit<CreateScopeOptions, "parentScopeId"> & {
            parentScopeId?: string;
          } = {}
        ) => {
          return this.createScope({
            parentScopeId: childOptions.parentScopeId ?? id,
          });
        },
      };
    };

    return createScopedEmitter(scopeId, options.parentScopeId);
  }

  /**
   * Subscribe to all events across all scopes
   */
  onScope(listener: Listener<ScopeEvent>): () => void {
    this.scopeListeners.add(listener);
    return () => {
      this.scopeListeners.delete(listener);
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
  onScopeStart(
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
          if (!this.scopeSubscribers.has(event.scopeId)) {
            this.scopeSubscribers.set(event.scopeId, new Set());
          }

          const scopeListeners = this.scopeSubscribers.get(event.scopeId)!;
          scopeListeners.add(listener);

          // Return unsubscribe function
          return () => {
            scopeListeners.delete(listener);
            // Clean up empty sets
            if (scopeListeners.size === 0) {
              this.scopeSubscribers.delete(event.scopeId);
              activeScopeIds.delete(event.scopeId);
              this.scopeParents.delete(event.scopeId);
            }
          };
        };

        // Call the handler with scopeId, subscribe function, and first event
        handler(event.scopeId, subscribeToScope, event);
      }
    };

    this.scopeListeners.add(scopeListener);

    // Return cleanup function
    return () => {
      this.scopeListeners.delete(scopeListener);
      activeScopeIds.clear();
    };
  }

  private hasListeners(): boolean {
    return this.scopeListeners.size > 0 || this.scopeSubscribers.size > 0;
  }
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
  "mutation:start": { variables: unknown; scopeId: string };
  "mutation:success": {
    variables: unknown;
    data: unknown;
    scopeId: string;
  };
  "mutation:error": {
    variables: unknown;
    error: unknown;
    scopeId: string;
  };
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

  // QueryClient events
  "client:change": { client: any };

  // Generic function execution events
  "function:pending": {
    name: string;
    args: any[];
    scopeId: string;
  };
  "function:success": {
    name: string;
    args: any[];
    result: any;
    scopeId: string;
  };
  "function:error": {
    name: string;
    args: any[];
    error: unknown;
    scopeId: string;
  };
}

export const eventEmitter = new EventEmitter<EventsMap>();
