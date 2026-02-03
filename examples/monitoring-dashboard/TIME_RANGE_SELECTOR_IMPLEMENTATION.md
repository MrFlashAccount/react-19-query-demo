# Time Range Selector Implementation

## Overview

Successfully implemented a comprehensive time range selector for the Server monitoring dashboard with preset ranges, manual refresh, auto-refresh, and a custom 2-thumb slider for selecting any range within the last 72 hours.

## Features Implemented

### 1. Time Range Presets

- **Last 5 minutes**
- **Last 15 minutes**
- **Last 30 minutes**
- **Last 1 hour**
- **Last 6 hours** (default)
- **Last 12 hours**
- **Last 24 hours**
- **Last 72 hours**

### 2. Manual Refresh

- Refresh button with loading state
- Updates data to latest "now" while maintaining selected duration
- Visual feedback during refresh transition

### 3. Auto-Refresh

Configurable intervals:

- **Off**
- **Every 5 seconds**
- **Every 10 seconds** (default, maintains existing behavior)
- **Every 30 seconds**
- **Every 1 minute**

### 4. Custom Range Selector

Interactive 2-thumb slider with constraints:

- **Range**: Any time between now and -72h
- **Step**: 1 hour increments
- **Min range**: 1 hour
- **Max range**: 24 hours
- Real-time display of From/To timestamps and duration
- Apply button to commit selection

## Technical Implementation

### Files Created

#### 1. `src/utilities/timeRange.ts`

Utility functions for time range parsing and formatting:

- `parseTimeRange()` - Parse preset and custom range strings
- `formatPresetLabel()` - Human-readable preset labels
- `formatDuration()` - Format milliseconds to readable durations
- `getMatchingPreset()` - Detect if current range matches a preset
- `timeRangeToHoursOffset()` - Convert timestamps to hour offsets
- `formatCustomRange()` - Format custom ranges for display

#### 2. `src/routes/Server/TimeRangeSelector.tsx`

Main component with three sections:

- **Range Selector Button** - Opens menu with presets
- **Refresh Button** - Manual refresh trigger
- **Auto-Refresh Dropdown** - Configure refresh interval
- **Custom Range Dialog** - 2-thumb slider interface

### Files Modified

#### 1. `src/routes/Server/ServerContext.tsx`

Extended context interface:

- `refreshData: () => void` - Manual refresh callback
- `autoRefreshInterval: number | null` - Current interval setting
- `setAutoRefreshInterval: (interval: number | null) => void` - Update interval

#### 2. `src/routes/Server.tsx`

Updated state management:

- Added `autoRefreshInterval` state (default: 10s)
- Replaced hardcoded refresh with dynamic interval based on setting
- Added `handleRefresh()` to update to latest data
- Integrated TimeRangeSelector in header (right side)
- Layout: Server title + selector on left, time controls on right

#### 3. `src/api/sw.tsx`

Server-side parsing for relative time ranges:

- **RSC endpoint** (`/rsc/server`):
  - Supports `range` parameter (e.g., `last_6h`, `custom:-12:0`)
  - Supports `endTime=now` keyword
  - Falls back to numeric `startTime`/`endTime`

- **Logs endpoint** (`/api/logs`):
  - Same `range` and `now` support
  - Backward compatible with numeric params

- **Metrics endpoint** (`/api/metrics/query`):
  - POST body supports `range` field
  - Supports `endTime: "now"`
  - Parses and replaces with numeric timestamps

#### 4. `src/components/AriaComponents/Menu/index.ts`

Added missing exports:

- `MenuTrigger`
- `MenuTriggerProps`

## API Reference

### Time Range Formats

#### Preset Format

```typescript
"last_5m" | "last_15m" | "last_30m" | "last_1h" | "last_6h" | "last_12h" | "last_24h" | "last_72h";
```

#### Custom Format

```typescript
"custom:<fromHours>:<toHours>";
// Example: "custom:-12:0" = 12 hours ago to now
// Hours are negative offsets from current time
```

#### URL Parameters

```
# Using range parameter
/rsc/server?range=last_6h&serverId=abc

# Using custom range
/rsc/server?range=custom:-24:-12&serverId=abc

# Legacy numeric format (still supported)
/rsc/server?startTime=1738599600000&endTime=1738621200000&serverId=abc

# Using "now" keyword
/rsc/server?startTime=1738599600000&endTime=now&serverId=abc
```

## UI/UX Details

### Range Selector Button

- Shows current range label
- Preset: "Last 6 hours"
- Custom: "Custom: -12h to now (12h)"
- Calendar icon for visual clarity
- Dropdown chevron indicates interactivity

### Menu Layout

- **Quick Select** section with all presets
- Separator
- **Custom Range** section with slider dialog trigger
- Active preset highlighted with background color

### Custom Range Dialog

- **3-column info display**:
  - From: Hour offset + formatted timestamp
  - To: "Now" or hour offset + timestamp
  - Duration: Total hours
- **Dual slider**:
  - Visual track showing active range
  - Two thumb controls for start/end
  - Automatic constraint enforcement (min 1h, max 24h)
  - Z-index management prevents thumb overlap issues
- **Hour markers**: Now, -12h, -24h, -36h, -48h, -60h, -72h

- **Apply button**: Commits selection (prevents accidental changes)

### Auto-Refresh Dropdown

- Shows current setting: "Off", "Every 10s", etc.
- Active option highlighted
- Updates take effect immediately

### Manual Refresh Button

- Reload icon only (compact)
- Shows spinner during refresh
- Disabled while loading

## Performance Considerations

- **Auto-refresh optimization**: Single interval, cleans up on unmount
- **Transition management**: Uses React's `startTransition` for non-blocking updates
- **Slider constraints**: Real-time adjustment prevents invalid ranges
- **State persistence**: Maintains duration when refreshing to "now"

## Backward Compatibility

All existing numeric time parameter APIs remain functional:

- Direct `startTime`/`endTime` millisecond timestamps
- Existing queries and components work unchanged
- New `range` parameter is opt-in

## Testing Checklist

✅ Build succeeds without errors
✅ Dev server starts successfully
✅ All presets selectable from menu
✅ Custom range slider constrains min/max properly
✅ Manual refresh updates to latest data
✅ Auto-refresh can be turned on/off
✅ Server-side parsing handles all formats
✅ Backward compatibility maintained

## Development Server

Running at: **http://localhost:5174/**

Navigate to the Server page to test all features.

## Future Enhancements

Potential improvements:

1. Persist selected range in URL query params
2. Add "Last 48h" preset between 24h and 72h
3. Save user's preferred auto-refresh setting to localStorage
4. Add keyboard shortcuts for common actions
5. Show data age indicator ("Updated 5s ago")
6. Add "quick jump" buttons in custom range (Last 1h, 6h, 24h from any point)
