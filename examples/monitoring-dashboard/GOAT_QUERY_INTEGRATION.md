# ✅ Goat-Query Integration for RSC

## Changes Made

Refactored RSC fetching to use goat-query instead of direct `use(fetchRSC())` pattern for better caching, invalidation, and state management.

## Files Modified

### 1. `src/queries/index.ts`

**Added:**

- Import `fetchRSC` from `@lib/rsc-service-worker-bff/rsc`
- New `serverRSCQuery` definition with params type
- Proper staleTime and gcTime configuration

```typescript
interface ServerRSCParams {
  serverId: string | null;
  startTime: number;
  endTime: number;
  limit: number;
  offset: number;
}

export const serverRSCQuery = query<ServerRSCParams, React.ReactElement>({
  queryFn: async ({ serverId, startTime, endTime, limit, offset }) => {
    const params = new URLSearchParams({
      startTime: String(startTime),
      endTime: String(endTime),
      limit: String(limit),
      offset: String(offset),
    });
    if (serverId) {
      params.set("serverId", serverId);
    }

    const rscUrl = `/rsc/server?${params}`;
    return fetchRSC<React.ReactElement>(rscUrl);
  },
  staleTime: 1000,
  gcTime: 5_000,
});
```

### 2. `src/routes/Server.tsx`

**Changed:**

- Added `serverRSCQuery` to imports
- Removed direct `fetchRSC` import
- Refactored `ServerBody` component to use `useQuery` hook

**Before:**

```typescript
const rscUrl = `/rsc/server?${params}`;
const element = use(fetchRSC(rscUrl));
return element;
```

**After:**

```typescript
const { promise } = useQuery({
  query: serverRSCQuery,
  params: { serverId, startTime, endTime, limit, offset },
});

const element = use(promise);
return element;
```

## Benefits

### 1. **Automatic Caching**

- RSC responses cached for 1 second (staleTime)
- Reduces redundant SW calls for identical params
- Garbage collected after 5 seconds of inactivity

### 2. **Request Deduplication**

- Multiple components requesting same RSC get single fetch
- Prevents race conditions

### 3. **Invalidation Support**

- Can invalidate RSC cache when server data changes
- Integrates with mutation invalidation system

### 4. **Consistent API**

- Uses same pattern as other queries in the app
- Follows goat-query conventions

### 5. **Better Error Handling**

- Query errors handled by goat-query system
- Retry logic available if needed

## Cache Configuration

| Setting   | Value  | Reasoning                                        |
| --------- | ------ | ------------------------------------------------ |
| staleTime | 1000ms | RSC data relatively fresh, but allow brief cache |
| gcTime    | 5000ms | Keep in memory briefly for quick navigation      |

## Verification

- ✅ **Linting:** 0 warnings, 0 errors
- ✅ **Type Checking:** 0 errors
- ✅ **Build:** Success (Exit code 0)
- ✅ **Bundle Size:** 2,067.74 kB (gzip: 602.56 kB)

## Usage Pattern

The RSC is now fetched using the standard goat-query pattern:

```typescript
const { promise } = useQuery({
  query: serverRSCQuery,
  params: { serverId, startTime, endTime, limit, offset },
});

const element = use(promise);
```

This matches the pattern used elsewhere in the codebase for consistency.

## Future Enhancements (Optional)

1. **Optimistic Updates**: Update RSC cache optimistically on mutations
2. **Prefetching**: Prefetch next time range on time navigation
3. **Retry Logic**: Add retry configuration for failed RSC requests
4. **Cache Invalidation**: Invalidate on server/metrics mutations

**Integration Complete!** 🎉
