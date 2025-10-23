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
  private activeQueries: Map<
    string,
    {
      key: Array<unknown>;
      queryFn: (key: Array<unknown>) => Promise<unknown>;
      options: {
        gcTime?: number;
        staleTime?: number | "static";
        retry?: any;
        retryDelay?:
          | number
          | ((failureCount: number, error: unknown) => number);
      };
    }
  >;

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
  register<Key extends Array<unknown>, PromiseValue extends unknown>(
    key: Key,
    queryFn: (key: Key) => Promise<PromiseValue>,
    options: {
      gcTime?: number;
      staleTime?: number | "static";
      retry?: any;
      retryDelay?: number | ((failureCount: number, error: unknown) => number);
    }
  ): void {
    const keySerialized = JSON.stringify(key);
    this.activeQueries.set(keySerialized, {
      key,
      queryFn: queryFn as (key: Array<unknown>) => Promise<unknown>,
      options,
    });
  }

  /**
   * Unregister a query from background refetching
   *
   * @param key - The query key
   */
  unregister<Key extends Array<unknown>>(key: Key): void {
    const keySerialized = JSON.stringify(key);
    this.activeQueries.delete(keySerialized);
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
   * Refetch all stale queries
   */
  private refetchStaleQueries(): void {
    for (const [, queryInfo] of this.activeQueries.entries()) {
      const { key, queryFn, options } = queryInfo;

      // Check if query is stale
      if (this.queryCache.has(key) && this.queryCache.isStale(key)) {
        const entry = this.queryCache.getPromise(key);

        // Only refetch if data has been successfully fetched before
        if (entry != null && entry.isFulfilled) {
          // Trigger a new addPromise which will handle the background refetch
          this.queryCache.addPromise({
            key,
            queryFn,
            ...options,
          });
        }
      }
    }
  }
}
