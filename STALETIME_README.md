# StaleTime API

## Overview

The `staleTime` API controls how long cached data is considered "fresh" before it becomes eligible for background refetching. This helps optimize network requests by preventing unnecessary refetches of recently fetched data.

## How It Works

### Basic Concept

- **Fresh data**: Data that is within its `staleTime` window. No refetches will be triggered.
- **Stale data**: Data that has exceeded its `staleTime` window. Will be refetched in the background when certain conditions are met.

### Default Behavior

By default, `staleTime` is `0` milliseconds, meaning data becomes stale immediately after being fetched. This ensures you always get the freshest data but may result in more network requests.

## Configuration Options

### Numeric Values

Set `staleTime` to a number of milliseconds:

```tsx
useQuery({
  key: ["movies", searchQuery],
  queryFn: () => fetchMovies(searchQuery),
  staleTime: 2 * 60 * 1000, // Fresh for 2 minutes
});
```

### Infinity

Set `staleTime` to `Infinity` to keep data fresh indefinitely (until manually invalidated):

```tsx
useQuery({
  key: ["static-data"],
  queryFn: () => fetchStaticData(),
  staleTime: Infinity, // Never becomes stale
});
```

### 'static'

Set `staleTime` to `'static'` to prevent any refetches, even manual invalidation:

```tsx
useQuery({
  key: ["permanent-data"],
  queryFn: () => fetchPermanentData(),
  staleTime: "static", // Never refetches, even with invalidate()
});
```

## Background Refetch Triggers

Stale data is automatically refetched in the background when:

1. **New instances of the query mount** (after the first mount)

   - When you navigate back to a component that uses the query
   - When a component remounts with the same query key

2. **Window is refocused**

   - User switches back to the browser tab
   - User returns to the application window

3. **Network is reconnected**
   - Internet connection is restored after being offline
   - Network state changes from offline to online

## Examples

### Example 1: Frequently Updated Data

```tsx
// Stock prices - refetch every 30 seconds
useQuery({
  key: ["stock-price", ticker],
  queryFn: () => fetchStockPrice(ticker),
  staleTime: 30 * 1000, // 30 seconds
});
```

### Example 2: Moderately Updated Data

```tsx
// User profile - fresh for 5 minutes
useQuery({
  key: ["user", userId],
  queryFn: () => fetchUser(userId),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### Example 3: Rarely Updated Data

```tsx
// Configuration data - fresh indefinitely
useQuery({
  key: ["app-config"],
  queryFn: () => fetchAppConfig(),
  staleTime: Infinity,
});
```

### Example 4: Static Data

```tsx
// Build-time data that never changes
useQuery({
  key: ["build-info"],
  queryFn: () => fetchBuildInfo(),
  staleTime: "static",
});
```

## Relationship with gcTime

`staleTime` and `gcTime` serve different purposes:

- **`staleTime`**: Controls when data becomes stale and eligible for background refetching
- **`gcTime`**: Controls when unused data is removed from the cache (after all subscriptions are removed)

Example:

```tsx
useQuery({
  key: ["movies"],
  queryFn: fetchMovies,
  staleTime: 2 * 60 * 1000, // Fresh for 2 minutes
  gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes after unmount
});
```

In this example:

- Data is fresh for 2 minutes after fetching
- After 2 minutes, data becomes stale and will refetch on remount/refocus/reconnect
- After unmounting, data stays in cache for 5 minutes before being garbage collected
- If you remount within 5 minutes, you'll see the cached data immediately (but it may trigger a background refetch if stale)

## Implementation Details

### Staleness Check

The `QueryCache` provides an `isStale()` method that checks:

1. If entry doesn't exist → stale
2. If `staleTime === 'static'` → never stale
3. If `staleTime === Infinity` → never stale
4. If data hasn't been fetched yet → stale
5. If `staleTime === 0` or `undefined` → always stale
6. Otherwise, compare `Date.now()` with `dataUpdatedAt + staleTime`

### Invalidation Behavior

The `invalidate()` method respects `staleTime`:

- Entries with `staleTime: 'static'` are **never invalidated**
- All other entries (including `Infinity`) can be manually invalidated

### Background Refetch Logic

1. **On Remount**: Checks if data is stale and has been successfully fetched before
2. **On Focus/Reconnect**: Same staleness check, triggers refetch in background
3. **First Mount**: No background refetch is triggered to avoid double-fetching

## Testing

The implementation includes comprehensive tests covering:

- Staleness checks with different `staleTime` values
- Time-based staleness transitions
- Invalidation behavior with `'static'` staleTime
- Background refetch scenarios
- Integration with subscription lifecycle

Run tests with:

```bash
npm test
```

## Migration Guide

If you're updating from a version without `staleTime`:

### Before

```tsx
useQuery({
  key: ["data"],
  queryFn: fetchData,
  gcTime: 5 * 60 * 1000,
});
```

### After

```tsx
useQuery({
  key: ["data"],
  queryFn: fetchData,
  gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes after unmount
  staleTime: 2 * 60 * 1000, // Fresh for 2 minutes (add this)
});
```

**Note**: Without `staleTime`, data is refetched on every remount, refocus, and reconnect (default `staleTime: 0`).

## Best Practices

1. **Match staleTime to your data's update frequency**

   - Real-time data: 0-30 seconds
   - Frequently updated: 1-5 minutes
   - Occasionally updated: 5-30 minutes
   - Rarely updated: Infinity

2. **Set staleTime >= gcTime for optimal caching**

   - This ensures data stays fresh while in cache
   - Prevents unnecessary refetches for cached data

3. **Use 'static' sparingly**

   - Only for truly immutable data
   - Consider using `Infinity` instead for most cases

4. **Consider user experience**
   - Longer `staleTime` = fewer network requests, but potentially stale data
   - Shorter `staleTime` = fresher data, but more network requests

## Performance Considerations

- **Memory**: `staleTime` doesn't affect memory usage (controlled by `gcTime`)
- **Network**: Longer `staleTime` reduces network requests significantly
- **Freshness**: Trade-off between data freshness and network efficiency
- **Background refetches**: Don't block UI, happen asynchronously

## Browser Compatibility

The window focus and network reconnect features use:

- `window.addEventListener('focus', ...)`
- `window.addEventListener('online', ...)`

These are supported in all modern browsers. The implementation gracefully handles environments without these APIs (e.g., tests, Node.js).
