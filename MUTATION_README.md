# useMutation Hook

## Overview

The `useMutation` hook is designed for performing async mutations with automatic query invalidation and async transition support. It complements the `useQuery` hook by handling data modifications and ensuring the cache stays up-to-date.

## Features

- **Async Transitions**: All mutations are automatically wrapped in React's `useTransition` for better UX during updates
- **Query Invalidation**: Automatically invalidate and refetch specified queries after successful mutation
- **State Management**: Built-in tracking of loading, error, and data states
- **Stable API**: The `mutate` function is stable and won't cause unnecessary re-renders
- **Type Safety**: Fully typed with TypeScript generics

## Basic Usage

```tsx
import { useMutation } from "./QueryProvider";

function UpdateMovie() {
  const { mutate, isPending, error } = useMutation({
    mutationFn: (movie: Movie) => updateMovie(movie),
    invalidateQueries: [["movies"]], // Refetch all movie queries after success
  });

  const handleUpdate = async () => {
    try {
      const data = await mutate({ id: 1, title: "New Title" });
      console.log("Updated:", data);
    } catch (err) {
      // Error is also available in the error state
    }
  };

  return (
    <div>
      <button onClick={handleUpdate} disabled={isPending}>
        {isPending ? "Updating..." : "Update"}
      </button>
      {error && <div>Error: {error.message}</div>}
    </div>
  );
}
```

## API

### Options

```typescript
interface UseMutationOptions<Variables, Data> {
  /** Function that performs the mutation */
  mutationFn: (variables: Variables) => Promise<Data>;

  /** Array of query keys to invalidate after successful mutation */
  invalidateQueries?: Array<Array<unknown>>;
}
```

### Return Value

```typescript
interface UseMutationResult<Variables, Data> {
  /** Function to trigger the mutation */
  mutate: (variables: Variables) => Promise<Data>;

  /** Whether the mutation is currently running */
  isPending: boolean;

  /** Error from the last mutation attempt, or null if no error */
  error: Error | null;
}
```

**Note:** Data is returned directly from the `mutate` promise, not stored in state.

## Query Invalidation

When you specify `invalidateQueries`, the hook will automatically:

1. Remove matching entries from the cache (supports prefix matching)
2. Force components using those queries to refetch the data
3. Update the UI with fresh data

### Prefix Matching

Query invalidation supports **prefix matching**, meaning you can invalidate multiple queries at once:

```tsx
const { mutate } = useMutation({
  mutationFn: updateMovie,
  invalidateQueries: [
    ["movies"], // Invalidates ALL queries starting with ['movies']
    // including ['movies'], ['movies', 'action'],
    // ['movies', 'comedy', 'popular'], etc.

    ["movies", "action"], // Invalidates only queries starting with ['movies', 'action']
    // including ['movies', 'action'] and
    // ['movies', 'action', 'popular'], but NOT ['movies', 'comedy']
  ],
});
```

### How Prefix Matching Works

- `['movies']` matches:

  - `['movies']` ✅
  - `['movies', 'action']` ✅
  - `['movies', 'action', 'popular']` ✅
  - `['movies', 'comedy', 'new']` ✅
  - `['users']` ❌

- `['movies', 'action']` matches:
  - `['movies', 'action']` ✅
  - `['movies', 'action', 'popular']` ✅
  - `['movies', 'comedy']` ❌
  - `['movies']` ❌ (prefix is longer than the key)

This makes it easy to invalidate entire categories of queries with a single key.

## Async Transitions

All mutations are wrapped in `useTransition`, which means:

- The UI won't freeze during mutations
- React can interrupt slow mutations if needed
- The `isPending` state is available for showing loading indicators
- Better user experience with automatic batching

## Example: Movie Rating Update

Here's a real-world example from the app:

```tsx
function MovieList({ query }: { query: string }) {
  const promise = useQuery({
    key: ["movies", query],
    queryFn: () => searchMovies(query),
    gcTime: 60_000,
  });

  const movies = use(promise);

  const { mutate: updateRating, isPending } = useMutation({
    mutationFn: ({ movieId, rating }: { movieId: number; rating: number }) =>
      updateMovieRating(movieId, rating),
    // Invalidate all movie queries (all searches will refetch)
    invalidateQueries: [["movies"]],
  });

  return (
    <div>
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onUpdateRating={updateRating}
          isUpdating={isPending}
        />
      ))}
    </div>
  );
}

function MovieCard({ movie, onUpdateRating, isUpdating }) {
  const handleRatingClick = () => {
    onUpdateRating({ movieId: movie.id, rating: movie.rating + 0.1 });
  };

  return (
    <div>
      <button onClick={handleRatingClick} disabled={isUpdating}>
        {movie.rating}
      </button>
      {isUpdating && <span>Updating...</span>}
    </div>
  );
}
```

## Error Handling

Errors can be handled in two ways:

1. **Via the error state:**

```tsx
const { mutate, error } = useMutation({ mutationFn });

if (error) {
  return <div>Error: {error.message}</div>;
}
```

2. **Via try-catch:**

```tsx
const { mutate } = useMutation({ mutationFn });

try {
  await mutate(variables);
} catch (err) {
  console.error("Mutation failed:", err);
}
```

## Best Practices

1. **Invalidate Related Queries**: Always specify which queries should be refetched after a successful mutation
2. **Handle Loading States**: Use `isPending` to show loading indicators
3. **Handle Errors**: Display error messages to users when mutations fail
4. **Stable Functions**: The `mutate` function is stable thanks to `useEvent`, so it's safe to use in dependency arrays
5. **Async/Await**: The `mutate` function returns a promise, so you can use async/await

## Comparison with React Query

If you're familiar with React Query's `useMutation`:

| Feature            | Our Implementation         | React Query        |
| ------------------ | -------------------------- | ------------------ |
| Async transitions  | ✅ Built-in                | ❌ Manual          |
| Query invalidation | ✅ Via `invalidateQueries` | ✅ Via `onSuccess` |
| Loading state      | ✅ `isPending`             | ✅ `isLoading`     |
| Error state        | ✅ `error`                 | ✅ `error`         |
| Data return        | ✅ Via promise             | ✅ `data` state    |
| Stable mutate fn   | ✅ Via `useEvent`          | ✅ Via memoization |

## Implementation Details

The `useMutation` hook:

1. Uses `useEvent` to create a stable `mutationFn` callback
2. Wraps the mutation in `useTransition` for better UX
3. Manages internal state for error (data is returned via promise)
4. Calls `queryCache.invalidate()` for each query key after success
5. Returns a stable `mutate` function that can be safely passed to child components

## Cache Integration

The hook integrates with the `QueryCache`:

- After a successful mutation, it calls `cache.invalidate(key)` for each specified query key
- This removes the cache entry, forcing a refetch on next access
- Components using `useQuery` with those keys will automatically show fresh data
