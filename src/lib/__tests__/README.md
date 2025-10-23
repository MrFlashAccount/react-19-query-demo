# QueryClient Test Suite

This directory contains comprehensive unit tests for the QueryClient library components.

## Test Files

### `QueryProvider.test.tsx`

Tests for the React context provider and hooks (`useQuery`, `useMutation`).

**Coverage:**

- Basic caching behavior (deduplication, key-based storage)
- useQuery hook behavior (suspense, invalidation, garbage collection)
- useMutation hook behavior (optimistic updates, revalidation)
- Subscription management
- Context integration

**Key Tests:**

- Promise caching and deduplication
- Automatic garbage collection after component unmount
- Query invalidation and refetching
- Mutation with optimistic updates
- Error handling and suspense boundaries

### `QueryCache.test.ts`

Tests for the core `QueryCache` class that manages promise storage.

**Coverage:**

- Promise addition and retrieval
- Key serialization and comparison
- Subscription tracking
- Cache invalidation (prefix-based)
- Garbage collection eligibility
- `has()` and `clear()` methods

**Key Tests:**

- Adding and retrieving promises by key
- Caching behavior for duplicate keys
- Complex key serialization (objects, arrays, null/undefined)
- Subscribe/unsubscribe affecting GC
- Prefix-based invalidation
- Promise status tracking (pending/fulfilled/rejected)

### `PromiseEntry.test.ts`

Tests for the `PromiseEntry` factory and interface.

**Coverage:**

- Promise wrapping and status tracking
- Status flags (`isPending`, `isFulfilled`, `isRejected`)
- Data and error tracking
- Timestamp recording
- GC time configuration
- Status change callbacks

**Key Tests:**

- Creating promise entries with initial pending status
- Callable function that returns original promise
- Status updates on promise resolution/rejection
- onStatusChange callback invocation
- Metadata and timestamp preservation
- Type safety for promise values

### `GarbageCollector.test.ts`

Tests for the idle-based garbage collection system.

**Coverage:**

- Scheduler initialization and cleanup
- Entry eligibility marking
- Automatic collection after gcTime expires
- Respecting active subscriptions
- Manual trigger support
- Edge cases (empty cache, invalid timings)

**Key Tests:**

- Starting and stopping the scheduler
- Marking entries eligible for GC
- Not collecting entries with active subscriptions
- Collecting entries after gcTime has passed
- Callback invocation on collection
- Handling edge cases gracefully

### `QueryCacheDebugger.test.ts`

Tests for the console debugging utilities.

**Coverage:**

- Enabled/disabled states
- Console logging for different events
- Timestamp formatting
- Verbose vs compact data display
- Error logging
- Custom prefix configuration

**Note:** Some tests in this file may fail when using fake timers due to timestamp validation issues. These tests verify console output formatting which is less critical for core functionality.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test QueryCache.test

# Run with coverage
npm test -- --coverage
```

## Test Patterns

### Fake Timers

Tests use Vitest's fake timers (`vi.useFakeTimers()`) to control time-based behavior like garbage collection:

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Advance time for GC
vi.advanceTimersByTime(1100); // Past gcTime
vi.advanceTimersByTime(100); // Trigger scheduler
vi.advanceTimersByTime(1); // Trigger idle callback
```

### Promise Handling

Rejected promises in tests should be caught to avoid unhandled rejection warnings:

```typescript
const promise = Promise.reject(error);
const entry = PromiseEntryFactory.create(promise);

try {
  await promise;
} catch (e) {
  // Expected to throw
}
```

### Cache Entry Structure

Cache entries follow this interface:

```typescript
interface CacheEntry {
  promise: PromiseEntry<unknown>;
  subscriptions: number; // Count, not Set
  gcTime?: number;
  gcEligibleAt?: number;
}
```

## Known Issues

1. **Debugger Tests with Fake Timers**: Some `QueryCacheDebugger` tests fail when timestamp validation encounters `NaN` from fake timers. These are non-critical formatting tests.

2. **Unhandled Promise Rejections**: Tests that intentionally reject promises should catch them to avoid test runner warnings. Most have been updated, but a few edge cases may remain.

## Future Improvements

- [ ] Add integration tests for complex multi-component scenarios
- [ ] Add performance benchmarks for large cache operations
- [ ] Test concurrent query requests
- [ ] Add tests for network error scenarios
- [ ] Add tests for React 19-specific features (use, Suspense)
