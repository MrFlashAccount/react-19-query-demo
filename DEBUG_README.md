# QueryCache Debugger

The QueryCache includes a built-in debugger that provides detailed console logging of all cache operations, making it easy to understand what's happening with your queries during development.

## Features

- 🎯 **Automatic logging** of promise additions, updates, and deletions
- 📊 **Status change tracking** with visual indicators
- 🎨 **Color-coded console output** for easy reading
- 🔍 **Detailed information** about promise state, data, and errors
- 📦 **Single console group** for all cache operations
- ⏱️ **Optional timestamps** for performance analysis
- 🎚️ **Configurable verbosity** levels

## Quick Start

Enable debugging by passing options to the `QueryProvider`:

```tsx
import { QueryProvider } from "./QueryProvider";

function App() {
  return (
    <QueryProvider
      options={{
        debug: {
          enabled: true,
          showTimestamps: true,
          verboseData: false,
        },
      }}
    >
      <YourApp />
    </QueryProvider>
  );
}
```

## Configuration Options

### `enabled: boolean`

- **Default:** `false`
- Enable or disable all debug logging

### `prefix: string`

- **Default:** `"[QueryCache]"`
- Custom prefix for all log messages

### `showTimestamps: boolean`

- **Default:** `true`
- Show timestamps in the format `[HH:MM:SS.mmm]` before each log

### `verboseData: boolean`

- **Default:** `false`
- When `true`: Shows full data objects in logs
- When `false`: Shows summaries like `Array(5)` or `Object(3 keys)`

## What Gets Logged

All logs appear within a single persistent console group `[QueryCache] Debug Log`:

### ➕ Promise Addition

When a new promise is added to the cache:

```
[QueryCache] Debug Log
  [14:30:45.123] ➕ Added: ["movies","action"]
    Status: pending
    Timestamp: 2025-10-23T14:30:45.123Z
    GC Time: 5000ms
```

### 🔄 Promise Update

When an existing cache entry is accessed:

```
  [14:30:45.200] 🔄 Updated: ["movies","action"]
    Status: fulfilled
    Data: Array(10)
```

### ❌ Promise Deletion

When a promise is removed from the cache:

```
  [14:30:50.456] ❌ Deleted: ["movies","action"]
    Reason: garbage collected
```

or

```
  [14:30:51.789] ❌ Deleted: ["movies"]
    Reason: invalidated
```

### 📊 Status Changes

When a promise resolves or rejects:

```
  [14:30:45.234] 📊 Status Change: ["user",1]
    pending → fulfilled
    Timestamp: 2025-10-23T14:30:45.234Z
    Data: { id: 1, name: "John Doe" }
```

## Console Output Examples

With debugging enabled, all logs appear in a single persistent console group:

```
▼ [QueryCache] Debug Log
    [14:30:45.123] ➕ Added: ["movies","search","action"]
      Status: pending
      Timestamp: 2025-10-23T14:30:45.123Z
      GC Time: 5000ms
    [14:30:45.234] 📊 Status Change: ["movies","search","action"]
      pending → fulfilled
      Timestamp: 2025-10-23T14:30:45.234Z
      Data: Array(10)
    [14:30:46.100] ➕ Added: ["user",1]
      Status: pending
      Timestamp: 2025-10-23T14:30:46.100Z
      GC Time: 5000ms
    [14:30:50.456] ❌ Deleted: ["movies","search","action"]
      Reason: garbage collected
```

**Color Coding:**

- 🟢 **Green** - Fulfilled promises
- 🟠 **Orange** - Pending promises
- 🔴 **Red** - Rejected promises
- 🔵 **Blue** - Updates
- ❌ **Red** - Deletions
- 🟣 **Purple** - Cache snapshots

## Programmatic Access

You can access the debugger instance programmatically:

```tsx
import { useQueryContext } from './QueryProvider'

function MyComponent() {
  const { queryCache } = useQueryContext()
  const debugger = queryCache.getDebugger()

  // Toggle debugging at runtime
  debugger.setEnabled(true)

  // Check if debugging is enabled
  if (debugger.isEnabled()) {
    console.log('Debugging is active')
  }

  // Log cache snapshot
  debugger.logSnapshot(queryCache.getCache())
}
```

## QueryCacheDebugger API

The `QueryCacheDebugger` class provides these methods:

### `isEnabled(): boolean`

Check if debugging is currently enabled.

### `setEnabled(enabled: boolean): void`

Enable or disable debugging at runtime.

### `logAdd<T>(key: Array<unknown>, promiseEntry: PromiseEntry<T>): void`

Log a promise addition to the cache.

### `logUpdate<T>(key: Array<unknown>, promiseEntry: PromiseEntry<T>): void`

Log a promise update in the cache.

### `logDelete(key: Array<unknown>, reason?: string): void`

Log a promise deletion from the cache.

### `logStatusChange<T>(key, promiseEntry, oldStatus, newStatus): void`

Log a promise status change (pending → fulfilled/rejected).

### `logSnapshot(cache: Map<string, unknown>): void`

Log the entire cache state as a table.

## Best Practices

### Development vs Production

**Development:**

```tsx
<QueryProvider
  options={{
    debug: {
      enabled: true,
      showTimestamps: true,
      verboseData: true, // Full data for debugging
    },
  }}
>
```

**Production:**

```tsx
<QueryProvider
  options={{
    debug: {
      enabled: false, // Disable in production
    },
  }}
>
```

**Environment-based:**

```tsx
<QueryProvider
  options={{
    debug: {
      enabled: import.meta.env.DEV,
      showTimestamps: import.meta.env.DEV,
      verboseData: false,
    },
  }}
>
```

### Performance Considerations

The debugger has minimal performance impact when disabled. When enabled:

- All logs appear in a single console group to reduce clutter
- Data formatting is lazy (only when logs are expanded)
- No network overhead - all logging is local
- Group automatically opens when debugging is enabled
- Group automatically closes when debugging is disabled

### Debugging Tips

1. **Use verbose mode sparingly** - `verboseData: true` can flood the console with large objects
2. **Filter console logs** - Use browser DevTools to filter by `[QueryCache]`
3. **Check timestamps** - Identify slow queries by comparing timestamps
4. **Monitor GC patterns** - Watch for unexpected cache evictions
5. **Track invalidations** - Ensure invalidations happen when expected

## Example Use Cases

### Debugging Cache Misses

Enable debugging to see why queries aren't being cached:

```tsx
// Expected: Should see "Updated" log on second render
// Actual: Seeing "Added" log twice? Check your key serialization!
```

### Investigating Stale Data

Check when promises resolve and update:

```tsx
// Status change logs show exactly when data becomes available
// Compare timestamps to find slow queries
```

### Monitoring Memory Usage

Watch garbage collection:

```tsx
// See which queries are being cleaned up
// Verify GC timings are appropriate for your use case
```

### Testing Invalidation Logic

Verify that invalidations work correctly:

```tsx
// After calling invalidate(['movies'])
// Should see deletion logs for all matching keys
```

## Integration with Browser DevTools

The debugger works seamlessly with browser DevTools:

1. **Console Filtering**: Filter by `[QueryCache]` to see only cache logs
2. **Log Groups**: Expand/collapse groups to reduce clutter
3. **Copy Values**: Right-click logged data to copy to clipboard
4. **Timeline View**: Use timestamps to correlate with Network tab
5. **Performance**: Check if cache operations correlate with performance issues

## Troubleshooting

### No logs appearing?

- Check that `enabled: true` is set
- Verify you're looking at the correct console tab
- Clear console filters

### Too many logs?

- Set `verboseData: false` for summaries
- Use console filters to focus on specific keys
- Temporarily disable with `setEnabled(false)`

### Performance issues with debugging?

- Debugging has minimal overhead when disabled
- If needed, conditionally enable only for specific keys
- Consider using `verboseData: false` in production-like testing

## TypeScript Support

The debugger is fully typed with TypeScript:

```typescript
import type { QueryCacheDebuggerOptions } from "./QueryCacheDebugger";

const options: QueryCacheDebuggerOptions = {
  enabled: true,
  prefix: "[MyCache]",
  showTimestamps: true,
  verboseData: false,
};
```

## Advanced Usage

### Custom Logging

You can extend the debugger for custom logging:

```typescript
import { QueryCacheDebugger } from "./QueryCacheDebugger";

class CustomDebugger extends QueryCacheDebugger {
  logCustomEvent(key: Array<unknown>, data: unknown) {
    if (!this.isEnabled()) return;

    console.group(`Custom Event: ${JSON.stringify(key)}`);
    console.log(data);
    console.groupEnd();
  }
}
```

### Conditional Debugging

Enable debugging only for specific keys:

```typescript
const debugger = queryCache.getDebugger()

// Only log movie-related queries
const originalLogAdd = debugger.logAdd.bind(debugger)
debugger.logAdd = (key, promiseEntry) => {
  if (JSON.stringify(key).includes('movies')) {
    originalLogAdd(key, promiseEntry)
  }
}
```

## Related Documentation

- [QueryCache API](./README_QUERY_PROVIDER.md)
- [Testing Guide](./TEST_README.md)
- [Usage Examples](./USAGE.md)
