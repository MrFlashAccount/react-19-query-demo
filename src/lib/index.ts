/**
 * Query Cache Library
 *
 * A lightweight, React 19-compatible query caching solution with:
 * - Promise-based caching
 * - Automatic garbage collection
 * - Subscription tracking
 * - Debug logging
 * - Prefix-based invalidation
 */

// Core exports
export {
  QueryProvider,
  useQuery,
  useMutation,
  QueryContext,
  type QueryProviderProps,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryContextValue,
} from "./QueryProvider";

export {
  QueryCache,
  type QueryCacheOptions,
  type AddPromiseOptions,
} from "./QueryCache";

export { PromiseEntryFactory, type PromiseEntry } from "./PromiseEntry";

export {
  GarbageCollector,
  type CacheEntry,
  type GarbageCollectorOptions,
} from "./GarbageCollector";

export {
  QueryCacheDebugger,
  type QueryCacheDebuggerOptions,
} from "./QueryCacheDebugger";

export { Retrier, type RetryConfig, type RetrierOptions } from "./Retrier";
