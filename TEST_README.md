# Query Provider Tests

Comprehensive test suite for the Query Provider with garbage collection support.

## Features Tested

### 1. Basic Caching Behavior

- ✅ Cache promises and return the same promise on subsequent calls
- ✅ Cache different promises for different keys
- ✅ Retrieve cached promises with `getPromise`
- ✅ Return null for non-existent cache entries

### 2. Subscription Tracking

- ✅ Increment subscriptions when subscribing
- ✅ Decrement subscriptions when unsubscribing
- ✅ Never go below 0 subscriptions

### 3. GC Timing Without Active Subscriptions

- ✅ Remove cache entry after `gcTime` expires with no subscriptions
- ✅ Don't remove cache entry if `gcTime` is not specified
- ✅ Don't remove cache entry if `gcTime` is `Infinity`

### 4. GC Timing With Active Subscriptions

- ✅ **DO NOT** remove cache entry after `gcTime` if there are active subscriptions
- ✅ Start GC timer after all subscriptions are removed
- ✅ Cancel GC timer when subscribing after unsubscribe

### 5. useQuery Hook Integration

- ✅ Automatically subscribe and unsubscribe on mount/unmount
- ✅ Trigger GC after component unmounts
- ✅ Don't trigger GC while component is still mounted
- ✅ Share cache between multiple components using same key

### 6. Edge Cases

- ✅ Handle complex keys with objects
- ✅ Handle multiple unsubscribes gracefully
- ✅ Handle zero `gcTime` (immediate removal)

## Installation

First, install the dependencies:

```bash
npm install
```

Or if using pnpm:

```bash
pnpm install
```

## Running Tests

Run tests once:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test -- --watch
```

Run tests with UI:

```bash
npm run test:ui
```

## Test Structure

The test file (`src/App.test.tsx`) includes:

1. **Basic caching behavior** - 4 tests
2. **Subscription tracking** - 3 tests
3. **GC timing without active subscriptions** - 3 tests
4. **GC timing with active subscriptions** - 3 tests
5. **useQuery hook integration** - 4 tests
6. **Edge cases** - 3 tests

**Total: 20 comprehensive test cases**

## Key Implementation Details

### Subscription Management

The query provider tracks active subscriptions to each cache entry. When a component uses `useQuery`:

1. On mount, it subscribes to the query key
2. On unmount, it unsubscribes from the query key

### Garbage Collection Logic

- GC timer only starts when there are **zero active subscriptions**
- If a new subscription is added, the GC timer is cancelled
- When all subscriptions are removed, the GC timer starts
- After `gcTime` milliseconds, the cache entry is deleted (if still at 0 subscriptions)

### Example Usage in Tests

```typescript
// Create a query with 5 second GC time
const promise = useQuery({
  key: ["user", userId],
  queryFn: () => fetchUser(userId),
  gcTime: 5000,
});

// Component mounts -> subscription count = 1
// GC timer is NOT running (subscriptions > 0)

// Component unmounts -> subscription count = 0
// GC timer starts

// After 5 seconds -> cache entry is removed
```

## Coverage

All test cases use:

- ✅ Fake timers for testing GC timing
- ✅ React Testing Library for component testing
- ✅ Vitest for test runner and assertions
- ✅ Happy-DOM for DOM environment

## Notes

- All timers are mocked using `vi.useFakeTimers()` for deterministic testing
- Tests verify both the promise caching behavior and the subscription lifecycle
- Edge cases like multiple unsubscribes and complex keys are covered
