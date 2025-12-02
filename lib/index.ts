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
  useQueryClient,
  useQueryContext,
  QueryContext,
  type QueryProviderProps,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryContextValue,
} from "./react/QueryProvider";

export { QueryClient, type QueryClientOptions } from "./QueryClient";

export { QueryCache } from "./QueryCache";

export {
  DependencyGraph,
  query,
  mutation,
  isQuery,
  isMutation,
  getQueryInstanceKey,
  serializeParams,
  type Context,
  type QueryDefinition,
  type MutationDefinition,
} from "./DependencyGraph";

export { Retrier, type RetryConfig, type RetrierOptions } from "./Retrier";

export { TimerWheel, timerWheel, type TimerWheelOptions } from "./TimerWheel";

export { Query, type QueryState } from "./Query";
export { Mutation } from "./Mutation";

// Event system
export {
  EventEmitter,
  eventEmitter,
  type EventsMap,
  type ScopedEmitter,
  type ScopeEvent,
} from "./EventEmitter";

export {};
