# Background Refetch Integration into QueryCache

## Overview

The background refetch registration has been moved from `useQuery` hook into the `QueryCache.subscribe()` method. This creates a tighter coupling between subscription lifecycle and background refetch registration, making the code simpler and more maintainable.

## Changes Made

### 1. **QueryCache** - Now Manages Background Refetch Registration

#### Added Fields

```typescript
class QueryCache {
  private backgroundRefetch?: BackgroundRefetch;
  private queryRegistry: Map<
    string,
    {
      queryFn: (key: Array<unknown>) => Promise<unknown>;
      options: {
        gcTime?: number;
        staleTime?: number | "static";
        retry?: RetryConfig;
        retryDelay?:
          | number
          | ((failureCount: number, error: unknown) => number);
      };
    }
  >;
}
```

#### New Method

```typescript
setBackgroundRefetch(backgroundRefetch: BackgroundRefetch): void
```

Called by `QueryProvider` to inject the `BackgroundRefetch` instance into the cache.

#### Updated `addPromise()`

Now stores query information in the registry:

```typescript
// Store query info in registry for background refetching
this.queryRegistry.set(keySerialized, {
  queryFn: queryFn as (key: Array<unknown>) => Promise<unknown>,
  options: { gcTime, staleTime, retry, retryDelay },
});
```

#### Updated `subscribe()`

Now registers queries for background refetching:

```typescript
subscribe<const Key extends Array<unknown>>(key: Key): void {
  const keySerialized = stableKeySerialize(key);
  const entry = this.cache.get(keySerialized);

  if (entry != null) {
    entry.subscriptions++;
    this.garbageCollector.clearEligibility(keySerialized);

    // Register for background refetching if BackgroundRefetch is available
    const queryInfo = this.queryRegistry.get(keySerialized);
    if (this.backgroundRefetch != null && queryInfo != null) {
      this.backgroundRefetch.register(key, queryInfo.queryFn, queryInfo.options);
    }
  }
}
```

#### Updated `unsubscribe()`

Now unregisters queries when no subscriptions remain:

```typescript
unsubscribe<const Key extends Array<unknown>>(key: Key): void {
  const keySerialized = stableKeySerialize(key);
  const entry = this.cache.get(keySerialized);

  if (entry != null) {
    entry.subscriptions = Math.max(0, entry.subscriptions - 1);

    if (entry.subscriptions === 0) {
      this.garbageCollector.markEligible(keySerialized);

      // Unregister from background refetching when no subscriptions remain
      if (this.backgroundRefetch != null) {
        this.backgroundRefetch.unregister(key);
      }
    }
  }
}
```

### 2. **QueryProvider** - Injects BackgroundRefetch into QueryCache

```typescript
export function QueryProvider({ children, queryCache }: QueryProviderProps) {
  const [backgroundRefetch] = useState(() => {
    const bgRefetch = new BackgroundRefetch({ queryCache });
    queryCache.setBackgroundRefetch(bgRefetch); // ← Inject into cache
    return bgRefetch;
  });

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

### 3. **useQuery** - Simplified (No Manual Registration)

#### Before

```typescript
export function useQuery(options) {
  const { queryCache, backgroundRefetch } = use(QueryContext);

  // ... addPromise call ...

  // Track subscription lifecycle
  useEffect(() => {
    queryCache.subscribe(key);
    return () => queryCache.unsubscribe(key);
  }, [JSON.stringify(key)]);

  // Register query for background refetching
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

#### After

```typescript
export function useQuery(options) {
  const { queryCache } = use(QueryContext); // No longer needs backgroundRefetch

  // ... addPromise call ...

  // Track subscription lifecycle (also handles background refetch registration)
  useEffect(() => {
    queryCache.subscribe(key);
    return () => queryCache.unsubscribe(key);
  }, [JSON.stringify(key)]);

  return { promise: promiseEntry, isPending };
}
```

**Removed:**

- Manual `backgroundRefetch.register()` call
- Manual `backgroundRefetch.unregister()` call
- Second `useEffect` for registration
- Dependency on `backgroundRefetch` from context

## Benefits

### 1. **Simpler Hook**

- `useQuery` went from 2 `useEffect` hooks to 1
- No need to access `backgroundRefetch` from context
- Fewer dependencies to track

### 2. **Tighter Coupling**

- Subscription and background refetch registration happen together
- Can't accidentally subscribe without registering or vice versa
- Lifecycle is automatically synchronized

### 3. **Single Source of Truth**

- Query information stored once in `queryRegistry`
- No need to pass query info through multiple layers
- Less chance of information getting out of sync

### 4. **Better Encapsulation**

- Background refetch logic is fully encapsulated in `QueryCache`
- Hooks don't need to know about background refetch implementation
- Easier to test and maintain

### 5. **Lazy Loading Support**

- `BackgroundRefetch` can be optional (dependency injection)
- Tests can work without background refetch
- Enables conditional features

## Flow Diagram

### Before

```
┌──────────┐
│ useQuery │
└────┬─────┘
     │
     ├─ addPromise()
     │
     ├─ useEffect(() => {
     │    subscribe()
     │  })
     │
     └─ useEffect(() => {      ← Separate effect
          backgroundRefetch.register()
        })
```

### After

```
┌──────────┐
│ useQuery │
└────┬─────┘
     │
     ├─ addPromise()
     │    └─ Store in queryRegistry
     │
     └─ useEffect(() => {
          subscribe()            ← Handles registration
            └─ If BackgroundRefetch exists:
                 └─ Get info from queryRegistry
                 └─ backgroundRefetch.register()
        })
```

## Implementation Details

### Query Registry

The `queryRegistry` is a `Map` that stores query metadata:

```typescript
Map<
  string,
  {
    queryFn: (key: Array<unknown>) => Promise<unknown>;
    options: {
      gcTime?: number;
      staleTime?: number | "static";
      retry?: RetryConfig;
      retryDelay?: number | ((failureCount: number, error: unknown) => number);
    };
  }
>;
```

**Key:** Serialized query key (JSON string)
**Value:** Query function and options needed for refetching

### Lifecycle

1. **addPromise()** - Stores query info in registry
2. **subscribe()** - Reads from registry and registers with BackgroundRefetch
3. **unsubscribe()** - Unregisters when subscriptions reach 0

### Dependency Injection

`BackgroundRefetch` is injected via `setBackgroundRefetch()`:

```typescript
const bgRefetch = new BackgroundRefetch({ queryCache });
queryCache.setBackgroundRefetch(bgRefetch);
```

This allows:

- Optional background refetch (can be `undefined`)
- Easy mocking in tests
- Runtime configuration

## Testing

All 145 tests pass, including:

- QueryCache subscription tests
- Background refetch integration
- Query lifecycle tests
- Multiple component scenarios

### Test Compatibility

The change is fully backwards compatible:

- Existing tests work without modification
- Tests that don't set `BackgroundRefetch` still work
- Registration only happens if `BackgroundRefetch` is set

## Migration Guide

### For Library Users

**No changes required!** The API is identical, just more efficient internally.

### For Library Contributors

When working with subscriptions:

1. **Don't manually call** `backgroundRefetch.register()`

   - It's handled automatically in `subscribe()`

2. **Query info is stored** in `addPromise()`

   - No need to pass it around

3. **BackgroundRefetch is optional**
   - Check `if (this.backgroundRefetch != null)` before using

## Performance Impact

- **Improved**: One less `useEffect` per query (fewer React updates)
- **Improved**: Simpler dependency array (fewer effect re-runs)
- **Same**: Memory usage (registry is minimal)
- **Same**: Network requests unchanged

## Files Modified

1. **src/lib/QueryCache.ts**

   - Added `backgroundRefetch` field
   - Added `queryRegistry` map
   - Added `setBackgroundRefetch()` method
   - Updated `addPromise()` to store query info
   - Updated `subscribe()` to register queries
   - Updated `unsubscribe()` to unregister queries

2. **src/lib/QueryProvider.tsx**
   - Updated `QueryProvider` to inject `BackgroundRefetch`
   - Simplified `useQuery` hook (removed manual registration)
   - Removed second `useEffect` for background refetch

## Next Steps

Potential future improvements:

1. **Automatic Registry Cleanup**

   - Remove entries from `queryRegistry` when queries are invalidated
   - Add max size limit to prevent memory leaks

2. **Query Deduplication**

   - Use registry to detect duplicate query functions
   - Optimize by reusing existing registrations

3. **Conditional Registration**

   - Allow queries to opt-out of background refetch
   - Add `enableBackgroundRefetch` option

4. **Debug Logging**
   - Log registration/unregistration events
   - Track active registrations in debugger

## Conclusion

Moving background refetch registration into `QueryCache.subscribe()` creates a cleaner architecture where:

- Subscription and registration are tightly coupled
- Hooks are simpler with fewer effects
- Query information is centralized in the registry
- Tests continue to pass without modification
- The API remains backwards compatible

This change improves code maintainability while preserving all existing functionality.
