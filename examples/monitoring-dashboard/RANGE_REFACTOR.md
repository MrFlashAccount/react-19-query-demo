# Range-Based API Refactor

## Summary

Successfully refactored the monitoring dashboard to use **range parameters** instead of separate `startTime` and `endTime` values. This simplifies the API, improves consistency, and makes the code more maintainable.

## What Changed

### Before (Time-based)

```typescript
// Queries used separate startTime/endTime
params: { serverId, startTime: 1738599600000, endTime: 1738621200000 }

// State management tracked two values
const [startTime, setStartTime] = useState(() => Date.now() - 6 * 60 * 60 * 1000);
const [endTime, setEndTime] = useState(() => Date.now());

// Context passed time ranges
onTimeRangeChange?: (startTime: number, endTime: number) => void;
```

### After (Range-based)

```typescript
// Queries use single range parameter
params: { serverId, range: "last_6h" }
params: { serverId, range: "custom:-12:0" }

// State management tracks one value
const [range, setRange] = useState<string>("last_6h");

// Context passes range strings
onRangeChange?: (range: string) => void;
```

## Benefits

1. **Simpler API** - One parameter instead of two
2. **Type Safety** - Range strings are validated on server
3. **Easier to Reason About** - Presets are first-class citizens
4. **Better Caching** - Query keys are simpler and more predictable
5. **Cleaner URLs** - `/rsc/server?range=last_6h` vs `/rsc/server?startTime=...&endTime=...`
6. **Consistent** - All time references use the same format

## Files Modified

### 1. `src/queries/index.ts`

**Changes:**

- `ServerRSCParams`: Replaced `startTime`/`endTime` with `range: string`
- `MetricQueryParams`: Replaced `startTime`/`endTime` with `range: string`
- `LogQueryWithRange`: New interface extending `LogQuery` with `range` instead of times
- All query functions now pass `range` parameter

### 2. `src/routes/Server/ServerContext.tsx`

**Changes:**

- `ServerContextValue.startTime` → `range: string`
- `ServerContextValue.endTime` → removed
- `onTimeRangeChange` → `onRangeChange?: (range: string) => void`

### 3. `src/routes/Server.tsx`

**Changes:**

- State: `[startTime, setStartTime]` + `[endTime, setEndTime]` → `[range, setRange]`
- Handlers: `handleTimeRangeChange()` → `handleRangeChange()`
- Refresh: Uses `refreshKey` to trigger re-fetch with same range
- Auto-refresh: Increments `refreshKey` instead of updating times
- ServerProvider props: Updated to pass `range` and `onRangeChange`
- ServerBody props: Updated to accept `range` instead of times

### 4. `src/routes/Server/TimeRangeSelector.tsx`

**Changes:**

- Context usage: `startTime`/`endTime` → `range`
- Preset selection: Sets range string directly (`"last_6h"`)
- Current label: Derives from range string
- Custom range: Returns `"custom:-12:0"` format
- CustomRangeDialog: Parses range string instead of timestamps

### 5. `src/api/sw.tsx`

**No changes needed** - Server-side parsing already supports both formats:

- `range` parameter (new preferred way)
- Legacy `startTime`/`endTime` (still supported for backward compat)

## Range Format Specification

### Preset Ranges

Fixed duration from "now":

```
"last_5m"   → Last 5 minutes
"last_15m"  → Last 15 minutes
"last_30m"  → Last 30 minutes
"last_1h"   → Last 1 hour
"last_6h"   → Last 6 hours (default)
"last_12h"  → Last 12 hours
"last_24h"  → Last 24 hours
"last_72h"  → Last 72 hours
```

### Custom Ranges

Hour offsets from "now":

```
"custom:<fromHours>:<toHours>"

Examples:
"custom:-6:0"    → 6 hours ago to now
"custom:-24:-12" → 24h ago to 12h ago
"custom:-72:-48" → 72h ago to 48h ago
```

**Constraints:**

- `fromHours`: -72 to 0 (negative values)
- `toHours`: -72 to 0 (negative values)
- Duration: 1h minimum, 24h maximum
- Step: 1 hour increments

## How Refresh Works

### Before (Time-based)

```typescript
// Manual refresh updated endTime to now, recalculated startTime
const handleRefresh = () => {
  const now = Date.now();
  const duration = endTime - startTime;
  setEndTime(now);
  setStartTime(now - duration);
};
```

### After (Range-based)

```typescript
// Manual refresh increments key to force re-fetch with same range
// Server interprets "last_6h" as relative to current time
const handleRefresh = () => {
  setRefreshKey((prev) => prev + 1);
};

// Key prop on ServerBody triggers re-mount and fresh query
<ServerBody key={refreshKey} range={range} ... />
```

**Why this works:**

- Range like `"last_6h"` is always relative to "now"
- Server parses range on each request, calculating fresh timestamps
- Incrementing key forces React to re-fetch with current time
- No need to manually calculate new time boundaries

## Migration Guide

If you have code that uses the old time-based API:

### Frontend Changes

```typescript
// OLD
const [startTime, setStartTime] = useState(Date.now() - 3600000);
const [endTime, setEndTime] = useState(Date.now());
onTimeRangeChange(newStart, newEnd);

// NEW
const [range, setRange] = useState("last_1h");
onRangeChange("last_1h");

// Convert custom times to range format
const fromHours = (startTime - Date.now()) / (60 * 60 * 1000);
const toHours = (endTime - Date.now()) / (60 * 60 * 1000);
const rangeString = `custom:${fromHours}:${toHours}`;
```

### Backend (Service Worker)

No changes needed - server already supports both:

```typescript
// Both work:
/rsc/server?range=last_6h&serverId=abc
/rsc/server?startTime=1738599600000&endTime=1738621200000&serverId=abc
```

## Testing

✅ **Build Status:** Successful (0 errors)
✅ **Linter:** Clean (0 warnings)
✅ **Type Check:** Passing
✅ **Backward Compatibility:** Server still accepts legacy params

### Test Scenarios

1. ✅ Select preset ranges (5m, 15m, 30m, 1h, 6h, 12h, 24h, 72h)
2. ✅ Create custom ranges via slider
3. ✅ Manual refresh maintains selected range
4. ✅ Auto-refresh updates data with current time
5. ✅ Range persists across server selection changes
6. ✅ Custom range constraints enforced (min 1h, max 24h)

## Performance Impact

**Positive:**

- Simpler query keys improve cache hit rates
- Less state management overhead (1 value vs 2)
- Smaller query params in URLs

**Neutral:**

- Server-side parsing adds negligible overhead
- Client-side logic simplified offsets any minor costs

## Future Enhancements

1. **URL Persistence**: Add range to query params for shareable links

   ```typescript
   // /server?range=last_12h&serverId=abc
   ```

2. **Range History**: Track recently used custom ranges

   ```typescript
   const [recentRanges, setRecentRanges] = useState<string[]>([]);
   ```

3. **Smart Presets**: Suggest ranges based on data density

   ```typescript
   // If no data in last 6h, suggest "last_24h"
   ```

4. **Range Comparison**: Support comparing multiple ranges
   ```typescript
   params: {
     ranges: ["last_24h", "last_7d"];
   }
   ```

## Developer Notes

- **Default range**: `"last_6h"` matches previous 6-hour default
- **Refresh strategy**: Key-based re-mount ensures fresh data
- **Type safety**: Range strings validated on server, typed on client
- **Extensibility**: Easy to add new preset ranges or custom formats
