# goat-query

`goat-query` is a query library built around the way React 19 already wants to work.

It handles caching, retries, mutations, and invalidation without pulling you away from `Suspense`, `use(promise)`, and transitions.

## Why use it

- Works naturally with React 19 data flows.
- Gives you the usual query-library basics without a lot of extra ceremony.
- Keeps query and mutation logic close to the code that uses it.

## Install

```bash
pnpm add @lib/goat-query react react-dom
```

> The published package name is `@lib/goat-query`. It targets React 19 and React DOM 19.

## Quick start

Three tiny pieces.

### Step 1: define a query

```tsx
import { query } from "@lib/goat-query/react";

async function fetchMovies(search: string) {
  const res = await fetch(`/api/movies?search=${encodeURIComponent(search)}`);
  if (!res.ok) throw new Error("Failed to load movies");
  return res.json() as Promise<Array<{ id: string; title: string }>>;
}

export const moviesQuery = query({
  queryFn: ({ search }: { search: string }) => fetchMovies(search),
  staleTime: 5_000,
  gcTime: 60_000,
});
```

### Step 2: make the app registry

```tsx
import { DependencyGraph } from "@lib/goat-query/react";

const graph = new DependencyGraph([moviesQuery]);
```

This is just the app-level registry. You list your queries and mutations there so `goat-query` knows what exists and what should refresh later.

### Step 3: render it

```tsx
import { Suspense, use } from "react";
import { QueryProvider, useQuery } from "@lib/goat-query/react";

function MoviesList({ search }: { search: string }) {
  const { promise } = useQuery({
    query: moviesQuery,
    params: { search },
  });

  const movies = use(promise);

  return (
    <ul>
      {movies.map((movie) => (
        <li key={movie.id}>{movie.title}</li>
      ))}
    </ul>
  );
}

export function App() {
  return (
    <QueryProvider graph={graph}>
      <Suspense fallback={<p>Loading movies…</p>}>
        <MoviesList search="alien" />
      </Suspense>
    </QueryProvider>
  );
}
```

That is the loop:

1. describe how to fetch data
2. register the query
3. call `useQuery()`
4. read the promise with `use()`

## When you need mutations

Same idea for writes.

```tsx
import { mutation, useMutation } from "@lib/goat-query/react";

async function updateMovieRating(movieId: string, rating: number) {
  const res = await fetch(`/api/movies/${movieId}/rating`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });

  if (!res.ok) throw new Error("Failed to update rating");
  return res.json();
}

export const updateMovieRatingMutation = mutation({
  mutationFn: ({ movieId, rating }: { movieId: string; rating: number }) =>
    updateMovieRating(movieId, rating),
  invalidates: [moviesQuery],
});
```

Then register it in the same graph:

```tsx
const graph = new DependencyGraph([moviesQuery, updateMovieRatingMutation]);
```

And use it in React:

```tsx
const { mutate, isPending } = useMutation({
  mutation: updateMovieRatingMutation,
});
```

The nice part is that the typing stays connected. You define the mutation once, keep the invalidation next to it, and stop scattering that logic around the app.

## What you get out of the box

- cache entries keyed by query definition + params
- stale time and garbage collection controls
- retries
- typed mutation invalidation
- typed optimistic-update definitions in the mutation API
- React 19-style Suspense flows
- optional devtools when you want to inspect what is happening

## Devtools

```tsx
import { QueryDevtools } from "@lib/goat-query/devtools";
```

Other exports:

- `QueryLogger`
- `QueryPerformanceTracker`
- `QueryFlameGraph`

## Package entry points

- `@lib/goat-query` — core client, cache, graph primitives
- `@lib/goat-query/react` — React bindings plus core exports
- `@lib/goat-query/devtools` — debugging and inspection tools

## Want a real example?

Check `examples/movies-db` in this repo. That's the best place to see the intended shape in a real app.
