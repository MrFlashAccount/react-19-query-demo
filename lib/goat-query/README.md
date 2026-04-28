# goat-query

`goat-query` is a query library built around the way React 19 already wants to work.

I made it because I wanted the nice parts of query libraries - caching, invalidation, mutations, retries, devtools - without feeling like I was bolting a second framework onto React.

If you like `Suspense`, `use(promise)`, transitions, and strong TypeScript, that's the whole pitch.

## Why I like it

- **React 19-first** — `useQuery()` gives you a promise you can read with `use()`.
- **Transitions-native** — updates flow through React transitions instead of fighting them.
- **React Compiler-aware** — the build runs through `babel-plugin-react-compiler`.
- **Typed all the way through** — query params, results, invalidation targets, and optimistic-update definitions stay typed.
- **Small surface area** — core primitives, React bindings, and devtools. That's basically it.
- **Devtools included** — `QueryDevtools`, `QueryLogger`, `QueryPerformanceTracker`, and `QueryFlameGraph` are first-class exports.

## Install

```bash
pnpm add @lib/goat-query react react-dom
```

> The published package name is `@lib/goat-query`. It targets React 19 and React DOM 19.

## Quick start

Here's the smallest useful shape.

### Step 1: define a query

```tsx
import { query } from "@lib/goat-query/react";

export const moviesQuery = query({
  queryFn: async (params: { search: string }, ctx) => {
    return ctx.api.searchMovies(params.search);
  },
  staleTime: 5_000,
  gcTime: 60_000,
});
```

### Step 2: create a client

```tsx
import { DependencyGraph, QueryClient } from "@lib/goat-query/react";

const graph = new DependencyGraph([moviesQuery]);
export const queryClient = new QueryClient({ graph });
```

`DependencyGraph` sounds more dramatic than it is. It's just the place where you register queries and mutations so the client knows how they relate.

### Step 3: read data with Suspense

```tsx
import { Suspense, use } from "react";
import { QueryProvider, useQuery } from "@lib/goat-query/react";

function Movies({ search }: { search: string }) {
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

export function App({
  api,
}: {
  api: {
    searchMovies: (search: string) => Promise<Array<{ id: string; title: string }>>;
  };
}) {
  return (
    <QueryProvider queryClient={queryClient} context={{ api }}>
      <Suspense fallback={<p>Loading movies…</p>}>
        <Movies search="alien" />
      </Suspense>
    </QueryProvider>
  );
}
```

That's already the main loop:

1. describe how to fetch data
2. give the client a graph
3. call `useQuery()`
4. read the promise with `use()`

## When you need mutations

This is where the graph starts paying rent.

```tsx
import { mutation } from "@lib/goat-query/react";

export const updateMovieRatingMutation = mutation({
  mutationFn: (params: { movieId: string; rating: number }, ctx) =>
    ctx.api.updateMovieRating(params.movieId, params.rating),
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
