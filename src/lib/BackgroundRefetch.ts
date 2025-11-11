import type { QueryCache } from "./QueryCache";

/**
 * Options for BackgroundRefetch
 */
export interface BackgroundRefetchOptions {
  /** The QueryCache instance to monitor */
  queryCache: QueryCache;
  /** Whether to enable background refetching. Default: true */
  enabled?: boolean;
}

export interface BackgroundRefetchable {
  isStale(): boolean;
  refetch(): void;
  key: string;
  getState(): {
    status: "pending" | "success" | "error";
  };
}

/**
 * BackgroundRefetch manages automatic refetching of stale queries
 * when certain browser events occur (focus, online).
 *
 * Features:
 * - Refetches stale queries on window focus
 * - Refetches stale queries on network reconnect
 * - Only refetches fulfilled queries
 * - Integrates with QueryCache's staleness checking
 *
 * @example
 * ```typescript
 * const queryCache = new QueryCache();
 * const backgroundRefetch = new BackgroundRefetch({
 *   queryCache,
 *   enabled: true
 * });
 *
 * // ... later
 * backgroundRefetch.stop();
 * ```
 */
export class BackgroundRefetch {
  private queryCache: QueryCache;
  private enabled: boolean;
  private activeQueries: Map<string, BackgroundRefetchable>;

  constructor(options: BackgroundRefetchOptions) {
    this.queryCache = options.queryCache;
    this.enabled = options.enabled ?? true;
    this.activeQueries = new Map();

    if (this.enabled) {
      this.start();
    }
  }

  /**
   * Start listening for browser events
   */
  private start(): void {
    if (typeof window === "undefined") {
      return;
    }

    window.addEventListener("focus", this.handleFocus);
    window.addEventListener("online", this.handleOnline);
  }

  /**
   * Stop listening for browser events
   */
  stop(): void {
    if (typeof window === "undefined") {
      return;
    }

    window.removeEventListener("focus", this.handleFocus);
    window.removeEventListener("online", this.handleOnline);
    this.activeQueries.clear();
  }

  /**
   * Register a query for background refetching
   *
   * @param key - The query key
   * @param queryFn - Function to fetch data
   * @param options - Query options (gcTime, staleTime, retry, retryDelay)
   */
  register(entry: BackgroundRefetchable): void {
    this.activeQueries.set(entry.key, entry);
  }

  /**
   * Unregister a query from background refetching
   *
   * @param key - The query key
   */
  unregister(entry: BackgroundRefetchable): void {
    this.activeQueries.delete(entry.key);
  }

  /**
   * Handle window focus event
   */
  private handleFocus = (): void => {
    this.refetchStaleQueries();
  };

  /**
   * Handle network reconnect event
   */
  private handleOnline = (): void => {
    this.refetchStaleQueries();
  };

  /**
   * Refetch a specific query if it's stale
   *
   * @param key - The query key to refetch
   */
  refetchQuery(entry: BackgroundRefetchable): void {
    if (!entry.isStale()) {
      return;
    }

    if (entry.getState().status !== "success") {
      return;
    }

    entry.refetch();
  }

  /**
   * Refetch all stale queries
   */
  private refetchStaleQueries(): void {
    for (const entry of this.activeQueries.values()) {
      this.refetchQuery(entry);
    }
  }
}
