# Architecture Refactor: StaleTime API

## Overview

The staleTime API has been refactored to move the core logic into the `QueryCache` class and create a separate `BackgroundRefetch` class for handling browser events. This creates a cleaner separation of concerns and makes the architecture more maintainable.

## Changes Made

### 1. **QueryCache Class** - Now Handles Staleness and Retry Logic

#### Before

```typescript
addPromise({
  key: ["movies"],
  promise: fetchMovies(), // Raw promise
  gcTime: 60_000,
});
```

#### After

```typescript
addPromise({
  key: ["movies"],
  queryFn: () => fetchMovies(), // Function that returns promise
  gcTime: 60_000,
  staleTime: 2 * 60 * 1000,
  retry: 3, // Built-in retry support
  retryDelay: 1000,
});
```

#### Key Features

**Staleness Check in `addPromise()`:**

- Automatically checks if cached data is stale
- Returns fresh data immediately if not stale
- Triggers background refetch if data is stale but fulfilled
- Creates new entry if no cache exists or data is pending

**Integrated Retry Logic:**

- `Retrier` is now instantiated inside `QueryCache`
- Retry configuration passed through `addPromise()` options
- Automatic retry on failed requests

**Background Refetch:**

- Private `refetchInBackground()` method
- Called automatically when stale fulfilled data is accessed
- Returns old data immediately while fetching new data

### 2. **BackgroundRefetch Class** - Handles Browser Events

A new standalone class that monitors browser events and triggers refetches:

```typescript
class BackgroundRefetch {
  constructor({ queryCache, enabled });
  register(key, queryFn, options);
  unregister(key);
  stop();
}
```

#### Responsibilities

- Listens for `window.focus` events
- Listens for `window.online` events (network reconnect)
- Maintains registry of active queries
- Triggers refetch for all stale queries on events
- Integrates with `QueryCache.addPromise()` for refetches

#### Usage in QueryProvider

```typescript
export function QueryProvider({ children, queryCache }: QueryProviderProps) {
  const [backgroundRefetch] = useState(
    () => new BackgroundRefetch({ queryCache })
  );

  useEffect(() => {
    return () => {
      backgroundRefetch.stop();
    };
  }, [backgroundRefetch]);

  return (
    <QueryContext value={{ queryCache, backgroundRefetch }}>
      {children}
    </QueryContext>
  );
}
```

### 3. **Simplified `useQuery` Hook**

#### Before (Complex)

```typescript
export function useQuery(options) {
  // Manual retrier creation
  const retrier = new Retrier({ retry, retryDelay });

  // Manual promise creation
  const promise = new Promise((res, rej) =>
    retrier
      .execute(() => queryFn(key))
      .then(res)
      .catch(rej)
  );

  // Manual staleness checks
  const shouldRefetch = queryCache.has(key) && queryCache.isStale(key);

  // Manual background refetch effects
  useEffect(() => {
    if (shouldRefetch && promiseEntry.isFulfilled) {
      queryCache.invalidate(key);
      queryCache.addPromise({ key, promise: executeQuery() });
    }
  }, [key, shouldRefetch]);

  // Manual window focus/online listeners
  useBackgroundRefetch(() => {
    if (queryCache.has(key) && queryCache.isStale(key)) {
      // ... refetch logic
    }
  }, true);

  return { promise: promiseEntry, isPending };
}
```

#### After (Simple)

```typescript
export function useQuery(options) {
  const { key, queryFn, gcTime, staleTime, retry, retryDelay } = options;
  const { queryCache, backgroundRefetch } = use(QueryContext);

  // Staleness check and retry handled inside addPromise
  const promiseEntry = queryCache.addPromise({
    key: deferredKey,
    queryFn,
    gcTime,
    staleTime,
    retry,
    retryDelay,
  });

  // Track subscription lifecycle
  useEffect(() => {
    queryCache.subscribe(key);
    return () => queryCache.unsubscribe(key);
  }, [JSON.stringify(key)]);

  // Register for background refetching
  useEffect(() => {
    backgroundRefetch.register(deferredKey, queryFnCallback, {
      gcTime,
      staleTime,
      retry,
      retryDelay,
    });
    return () => backgroundRefetch.unregister(deferredKey);
  }, [JSON.stringify(deferredKey), gcTime, staleTime, retry, retryDelay]);

  return { promise: promiseEntry, isPending };
}
```

### 4. **Backwards Compatibility**

The `addPromise()` method supports both the old and new API:

```typescript
// Old API (still works)
queryCache.addPromise({
  key: ["movies"],
  promise: fetchMovies(),
  gcTime: 60_000,
});

// New API (preferred)
queryCache.addPromise({
  key: ["movies"],
  queryFn: () => fetchMovies(),
  gcTime: 60_000,
  staleTime: 2 * 60 * 1000,
  retry: 3,
});
```

This ensures all existing tests continue to pass without modification.

## Architecture Benefits

### Separation of Concerns

1. **QueryCache**: Manages cache, staleness logic, and retry
2. **BackgroundRefetch**: Handles browser events
3. **QueryProvider**: Orchestrates components
4. **useQuery**: Simple interface for React components

### Testability

- Each class can be tested independently
- BackgroundRefetch can be easily mocked
- QueryCache staleness logic is self-contained

### Maintainability

- Clear responsibilities for each class
- Easier to add new features (e.g., polling, websocket refetch)
- Reduced complexity in `useQuery` hook

### Extensibility

Easy to add new refetch triggers:

```typescript
class BackgroundRefetch {
  // Add new event listener
  private handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      this.refetchStaleQueries();
    }
  };
}
```

## Flow Diagram

```
┌─────────────────┐
│   useQuery()    │
└────────┬────────┘
         │
         ├─ Calls addPromise(queryFn, options)
         │
         ▼
┌─────────────────┐
│   QueryCache    │◄─────┐
└────────┬────────┘      │
         │                │
         ├─ Check if stale     │
         ├─ If stale & fulfilled: │
         │  └─ Return old data      │
         │  └─ Trigger refetchInBackground()
         ├─ If not stale:        │
         │  └─ Return cached data │
         └─ If no cache:         │
            └─ Create new entry  │
            └─ Use Retrier       │
                                 │
┌─────────────────┐             │
│BackgroundRefetch│             │
└────────┬────────┘             │
         │                      │
         ├─ Listen: focus       │
         ├─ Listen: online      │
         └─ On event:           │
            └─ For each registered query
               └─ If stale ─────┘
                  └─ Call addPromise()
```

## Migration Guide

### For Library Users

No changes required! The API is backwards compatible.

### For Library Contributors

When adding new features:

1. **Staleness logic** → Add to `QueryCache.isStale()`
2. **Refetch triggers** → Add to `BackgroundRefetch`
3. **Retry logic** → Modify `Retrier` class
4. **Cache management** → Add to `QueryCache`

## Performance Impact

- **Improved**: Staleness check happens once in `addPromise()`
- **Improved**: Background refetch is centralized and efficient
- **Same**: Memory usage unchanged
- **Same**: Network requests unchanged

## Files Modified

1. **src/lib/QueryCache.ts**

   - Added `queryFn` parameter support
   - Integrated `Retrier` instantiation
   - Added `refetchInBackground()` method
   - Staleness check in `addPromise()`

2. **src/lib/BackgroundRefetch.ts** (NEW)

   - Created separate class for browser events
   - Manages query registry
   - Handles focus and online events

3. **src/lib/QueryProvider.tsx**

   - Simplified `useQuery` hook
   - Added `BackgroundRefetch` to context
   - Removed manual event listeners
   - Removed manual staleness checks

4. **src/lib/index.ts**
   - Exported `BackgroundRefetch` class
   - Exported `useQueryContext` hook

## Testing

All 145 tests pass, including:

- QueryCache tests (staleness, retry, caching)
- QueryProvider tests (subscriptions, GC, invalidation)
- Integration tests (React components)

Run tests:

```bash
npm test
```

## Next Steps

Potential future enhancements:

1. **Polling Support**: Add to `BackgroundRefetch`
2. **WebSocket Refetch**: New event listener in `BackgroundRefetch`
3. **Optimistic Updates**: Add to `QueryCache`
4. **Request Deduplication**: Add to `QueryCache.addPromise()`
5. **Query Prefetching**: New method in `QueryCache`

## Conclusion

This refactor creates a clean, maintainable architecture where:

- Each class has a single responsibility
- Logic is centralized and reusable
- The API is backwards compatible
- Tests continue to pass
- Future enhancements are easier to add
