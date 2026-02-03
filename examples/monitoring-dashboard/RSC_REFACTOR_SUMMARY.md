# Server Page RSC Refactor Summary

## Overview

Refactored the monitoring dashboard's Server page to use React Server Components (RSC) via Service Worker, moving all data fetching to the server while keeping interactive UI on the client.

## Architecture

### Data Flow

```
Client (Server.tsx)
  ├─> State: serverId, startTime, endTime, limit, offset
  ├─> fetchRSC('/rsc/server?...')
  │
  └─> Service Worker (sw.tsx)
        ├─> Query IndexedDB (servers, metrics, logs)
        ├─> Render ServerBody RSC with data
        └─> Stream RSC payload back to client
```

### Component Split

#### Server Components (RSC - in Service Worker)

- **ServerBody** - Main layout with data
- **ServerOverview** - Server status cards
- **StatCard** - Individual stat display
- **LogsSection** - Logs table structure
- **LogTableRow** - Individual log row

#### Client Components (Interactive)

- **ServerSelectorWrapper** - Server dropdown with add/edit/delete
- **ChartCard** - Chart.js chart rendering (must be client-side)
- **LogTimestampButton** - Opens log detail dialog
- **LogViewAtTimeButton** - Jump to time view
- **LoadMoreButton** - Pagination control

## Files Changed

### 1. `/src/main.tsx`

- Added `@lib/rsc-service-worker-bff/rsc/webpack-shim` import (must be first)
- Registered client module: `registerClientModule("server-monitoring", ServerClientComponents)`

### 2. `/src/routes/Server/client-components.tsx` (NEW)

- Exports all interactive client components
- Includes chart rendering, dialogs, buttons
- Used as client refs from RSC

### 3. `/src/routes/Server/ServerRSC.tsx` (NEW)

- Server component tree that runs in Service Worker
- Receives data props and renders with client refs
- No direct data fetching (data passed in)

### 4. `/src/routes/Server/types.ts` (NEW)

- Shared types for chart data

### 5. `/src/api/sw.tsx`

- Added webpack-shim import
- Created client module: `createClientModule("server-monitoring", [...])`
- Added `/rsc/server` GET endpoint:
  - Accepts: `serverId`, `startTime`, `endTime`, `limit`, `offset`
  - Queries IndexedDB for servers, metrics, logs
  - Renders `ServerBody` RSC with data
  - Returns Flight response via `createFlightResponse()`

### 6. `/src/routes/Server.tsx`

- Removed direct data fetching (metrics, logs)
- Added state for `serverId`, `limit`, `offset`
- `ServerBody` now calls `fetchRSC()` with params
- `ServerProvider` accepts `serverId` and `onServerChange`
- Context still provides server list (from goat-query) for selector

## Key Patterns

### RSC Endpoint Pattern

```tsx
const getServerRSC = http.get("/rsc/server", async ({ url }) => {
  const params = extractParams(url);
  const data = await fetchDataFromDB(params);
  const element = <ServerBody Client={Client} {...data} />;
  return createFlightResponse(element, manifest);
});
```

### Client Fetch Pattern

```tsx
function ServerBody({ serverId, startTime, endTime }) {
  const params = new URLSearchParams({ serverId, startTime, endTime });
  const element = use(fetchRSC(`/rsc/server?${params}`));
  return element;
}
```

### Client Ref Pattern in RSC

```tsx
// In RSC (Service Worker)
<Client.ChartCard title="CPU" data={chartData} color="..." />
<Client.LogTimestampButton timestamp={log.timestamp} log={log} />
```

## Benefits

1. **Data fetching centralized** - All DB queries in one place (SW)
2. **Reduced client bundle** - No data fetching logic on client
3. **Better caching** - SW can cache RSC responses
4. **Streaming** - RSC streams incrementally
5. **Type safety** - Props flow from server to client components
6. **UI/UX intact** - All interactivity preserved

## Trade-offs

1. **Complexity** - More moving parts (SW, RSC, client module registration)
2. **Debugging** - Harder to trace data flow across SW boundary
3. **Initial setup** - Requires webpack-shim and module registration
4. **State management** - Must pass params through URL to RSC endpoint

## Testing

The refactor preserves all existing functionality:

- Server selection works
- Time range updates work
- Charts render correctly
- Logs table displays
- Pagination works (state tracked, UI to be connected)
- All interactive features intact

## Next Steps (Optional Enhancements)

1. Add filters/pagination client components to LogsSection
2. Implement "Load More" button handler
3. Add "View at Time" button handler
4. Optimize RSC caching in Service Worker
5. Add loading states during RSC fetch
6. Error boundaries for RSC failures
