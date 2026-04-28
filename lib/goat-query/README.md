# goat-query

`goat-query` is a React 19-native query library for people who want data fetching to feel like React, not like a second framework living next to it.

The short version: if you like `Suspense`, `use(promise)`, transitions, and strong TypeScript, this is a small, readable query layer built around those ideas.

## Why this exists

A lot of query libraries were shaped before React 19. `goat-query` is designed around React 19-style data flows from the start.

Instead of wrapping React with a big abstraction, it leans on React's own primitives:

- `useQuery()` gives you a promise you can read with `use()`
- `QueryProvider` updates through `startTransition()`
- `useMutation()` is built around React 19 transitions, with typed optimistic-update definitions in the mutation API
- the package build runs through the React Compiler plugin

So the mental model stays simple: define queries and mutations once, connect them with a dependency graph, and let the client handle caching, refetching, and invalidation.

## Why it's nice

- **React 19-oriented** — Suspense, `use(promise)`, and transitions are part of the normal flow.
- **React Compiler-aware** — the library build runs with `babel-plugin-react-compiler`.
- **Lean by design** — the surface area is intentionally small: core, React bindings, and devtools.
- **Strong end-to-end typing** — query params/results stay typed, invalidation targets are typed, and optimistic-update definitions stay typed with the mutation API.
- **Devtools included** — `QueryDevtools`, `QueryLogger`, `QueryPerformanceTracker`, and `QueryFlameGraph` ship as first-class exports.

## Install

```bash
pnpm add @lib/goat-query react react-dom
```

> The published package name is `@lib/goat-query`. It targets React 19 and React DOM 19.

## Quick start

```tsx
import { Suspense, use } from "react";
import {
  query,
  mutation,
  DependencyGraph,
  QueryClient,
  QueryProvider,
  useQuery,
  useMutation,
} from "@lib/goat-query/react";

type Movie = { id: string; title: string };
type MovieApi = {
  searchMovies: (searchQuery: string, movieLimit: number) => Promise<Movie[]>;
  updateMovieRating: (movieId: string, rating: number) => Promise<unknown>;
};

const moviesQuery = query({
  queryFn: (params: { searchQuery: string; movieLimit: number }, ctx) =>
    ctx.api.searchMovies(params.searchQuery, params.movieLimit),
  staleTime: 5_000,
  gcTime: 60_000,
});

const updateMovieRatingMutation = mutation({
  mutationFn: (params: { movieId: string; rating: number }, ctx) =>
    ctx.api.updateMovieRating(params.movieId, params.rating),
  invalidates: [moviesQuery],
});

const graph = new DependencyGraph([moviesQuery, updateMovieRatingMutation]);
const queryClient = new QueryClient({ graph });

export function App({ api }: { api: MovieApi }) {
  return (
    <QueryProvider queryClient={queryClient} context={{ api }}>
      <Suspense fallback={<p>Loading movies…</p>}>
        <Movies searchQuery="alien" movieLimit={10} />
      </Suspense>
    </QueryProvider>
  );
}

function Movies({ searchQuery, movieLimit }: { searchQuery: string; movieLimit: number }) {
  const { promise } = useQuery({
    query: moviesQuery,
    params: { searchQuery, movieLimit },
  });

  const movies = use(promise);
  const { mutate: updateRating } = useMutation({
    mutation: updateMovieRatingMutation,
  });

  return (
    <ul>
      {movies.map((movie) => (
        <li key={movie.id}>
          {movie.title}
          <button onClick={() => updateRating({ movieId: movie.id, rating: 5 })}>
            Rate 5
          </button>
        </li>
      ))}
    </ul>
  );
}
```

## Tiny overview

There are really only three pieces to keep in your head:

1. **Define queries and mutations** with `query()` and `mutation()`.
2. **Connect them in a `DependencyGraph`** so invalidation relationships live in one place and the client can follow them consistently.
3. **Use the React bindings** with `QueryProvider`, `useQuery()`, and `useMutation()`.

That gives you:

- cached query instances by definition + params
- stale time and garbage collection controls
- typed mutation invalidation and typed optimistic-update definitions in the API
- a React 19-first Suspense flow
- optional devtools when you want to inspect what's happening

## Devtools

If you want visibility while building, import from `@lib/goat-query/devtools`:

```tsx
import { QueryDevtools } from "@lib/goat-query/devtools";
```

Other available exports are `QueryLogger`, `QueryPerformanceTracker`, and `QueryFlameGraph`.

## Package entry points

- `@lib/goat-query` — core client/cache/graph primitives
- `@lib/goat-query/react` — React bindings plus core exports
- `@lib/goat-query/devtools` — debugging and inspection tools

If you want a concrete example, the `examples/movies-db` app in this repo shows the intended shape pretty well.