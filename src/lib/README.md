# Query Cache Library

A lightweight, React 19-compatible query caching solution with automatic garbage collection, subscription tracking, and debug logging.

## 📁 Directory Structure

```
src/lib/
├── index.ts                  # Public API exports
├── QueryProvider.tsx         # React context and hooks
├── QueryCache.ts            # Core caching logic
├── PromiseEntry.ts          # Promise wrapper with tracking
├── GarbageCollector.ts      # Automatic cache cleanup
└── QueryCacheDebugger.ts    # Debug logging utilities
```

## 📦 Files Overview

### `index.ts`

Central export file providing a clean public API for the library.

**Exports:**

- React components and hooks: `QueryProvider`, `useQuery`, `useMutation`
- Core classes: `QueryCache`, `GarbageCollector`, `PromiseEntryFactory`
- Type definitions for all public APIs

### `QueryProvider.tsx`

React context provider and custom hooks for query management.

**Exports:**

- `QueryProvider` - Context provider component
- `useQuery` - Hook for fetching and caching data
- `useMutation` - Hook for data mutations with invalidation
- `QueryContext` - React context (for testing)

**Key Features:**

- Automatic subscription management
- Promise suspense support (React 19)
- Deferred values for pending state
- Cache invalidation on mutations

### `QueryCache.ts`

Core caching engine that manages promise storage and retrieval.

**Exports:**

- `QueryCache` - Main cache class
- `AddPromiseOptions` - Options for adding promises
- `QueryCacheOptions` - Configuration options

**Key Features:**

- Key-based promise caching
- Subscription tracking
- Prefix-based invalidation
- Integrated debugging and GC

### `PromiseEntry.ts`

Factory for creating trackable promise wrappers.

**Exports:**

- `PromiseEntry` - Interface for tracked promises
- `PromiseEntryFactory` - Factory for creating entries

**Key Features:**

- Status tracking (pending/fulfilled/rejected)
- Convenience boolean flags
- Data and error storage
- Custom status change callbacks

### `GarbageCollector.ts`

Automatic cleanup system for expired cache entries.

**Exports:**

- `GarbageCollector` - GC management class
- `CacheEntry` - Cache entry interface
- `GarbageCollectorOptions` - Configuration options

**Key Features:**

- Configurable check intervals (default: 100ms)
- Uses `requestIdleCallback` for non-blocking GC
- Respects subscription counts
- Custom collection callbacks

### `QueryCacheDebugger.ts`

Console logging utilities for debugging cache operations.

**Exports:**

- `QueryCacheDebugger` - Debug logging class
- `QueryCacheDebuggerOptions` - Configuration options

**Key Features:**

- Color-coded console output
- Single persistent console group
- Timestamps and data formatting
- Event logging (add/update/delete/status changes)

## 🚀 Usage

### Basic Usage

```typescript
import { QueryProvider, useQuery } from "./lib";

function App() {
  return (
    <QueryProvider
      options={{
        debug: { enabled: true },
        gc: { checkInterval: 100 },
      }}
    >
      <YourApp />
    </QueryProvider>
  );
}

function YourComponent() {
  const { promise } = useQuery({
    key: ["users", userId],
    queryFn: () => fetchUser(userId),
    gcTime: 60_000,
  });

  const user = use(promise());
  return <div>{user.name}</div>;
}
```

### Advanced Usage

```typescript
import {
  QueryCache,
  PromiseEntryFactory,
  GarbageCollector,
  QueryCacheDebugger
} from './lib';

// Create custom cache with full control
const cache = new QueryCache({
  debug: {
    enabled: true,
    verboseData: true,
    showTimestamps: true
  },
  gc: {
    checkInterval: 200,
    onCollect: (key) => console.log('Collected:', key)
  }
});

// Create promise entries manually
const entry = PromiseEntryFactory.create(fetchData(), {
  gcTime: 5000,
  key: ['data', 1],
  onStatusChange: (old, new, entry) => {
    console.log(`Status: ${old} → ${new}`);
  }
});

// Access internals
const debugger = cache.getDebugger();
const gc = cache.getGarbageCollector();
```

## 🔧 Configuration

### QueryCacheOptions

```typescript
interface QueryCacheOptions {
  debug?: {
    enabled?: boolean; // Enable debug logging
    prefix?: string; // Log prefix
    showTimestamps?: boolean; // Show timestamps
    verboseData?: boolean; // Show full data objects
  };
  gc?: {
    checkInterval?: number; // GC check interval (ms)
    onCollect?: (key: string) => void; // Cleanup callback
  };
}
```

## 📊 Architecture

```
┌─────────────────┐
│  QueryProvider  │ ← React Integration
└────────┬────────┘
         │
┌────────▼────────┐
│   QueryCache    │ ← Core Cache Logic
└────┬──────┬─────┘
     │      │
┌────▼──┐ ┌▼─────────────┐
│  GC   │ │  Debugger    │ ← Supporting Services
└───────┘ └──────────────┘
     │
┌────▼────────────┐
│ PromiseEntry    │ ← Promise Wrapper
└─────────────────┘
```

## 🧪 Testing

All components are designed for easy testing:

```typescript
import { QueryCache } from "./lib";

// Access internals for testing
const cache = new QueryCache();
const cacheMap = cache.getCache();
const gc = cache.getGarbageCollector();

// Manual GC trigger
cache.triggerGarbageCollection();

// Check cache state
expect(cacheMap.size).toBe(0);
```

## 📝 Dependencies

- **React 19+** - For context, hooks, and suspense
- **TypeScript** - For type safety

No external dependencies required!

## 🔗 Related Files

- `../useEvent.ts` - Event callback hook
- `../types/` - Type definitions
- `../api/` - API layer (example usage)

## 📚 Further Reading

- [React 19 Suspense](https://react.dev/reference/react/Suspense)
- [Query Provider README](../../README_QUERY_PROVIDER.md)
- [Debug README](../../DEBUG_README.md)
- [Usage Guide](../../USAGE.md)
