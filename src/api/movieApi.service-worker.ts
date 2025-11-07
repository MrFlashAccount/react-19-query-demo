/// <reference lib="webworker" />

// TypeScript declarations for Service Worker context
declare const self: ServiceWorkerGlobalScope;

import type { Movie } from "../types/movie";

// Movie database cache
let movieDatabaseCache: Movie[] | null = null;

/**
 * Load the movie database from JSON files
 */
async function getDatabase(): Promise<Movie[]> {
  if (movieDatabaseCache != null) {
    return movieDatabaseCache;
  }

  const [movies1, movies2] = await Promise.all([
    fetch("/movies/1.json").then((res) => res.json()),
    fetch("/movies/2.json").then((res) => res.json()),
  ]);

  movieDatabaseCache = [...movies1, ...movies2].map(
    (movie) =>
      ({
        id: movie.id,
        titleText: movie.titleText.text,
        releaseYear: movie.releaseYear?.year ?? 0,
        genres: movie.genres.genres.map(
          (genre: { text: string }) => genre.text
        ),
        plot: movie.plot?.plotText.plainText ?? "",
        directors: [],
        rating: movie.ratingsSummary.aggregateRating ?? 0,
        image: movie.primaryImage?.url ?? "",
      } satisfies Movie)
  );
  return movieDatabaseCache;
}

/**
 * Search movies by query string.
 * Searches in title, genres, director, and plot.
 */
async function searchMovies(
  query: string,
  limit: number = 500
): Promise<Movie[]> {
  const database = await getDatabase();

  if (!query.trim()) {
    return database.slice(0, limit);
  }

  const searchTerm = query.toLowerCase();
  return database
    .filter((movie) => {
      // Search in title
      if (movie.titleText.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in genres
      if (
        movie.genres.some((genre) => genre.toLowerCase().includes(searchTerm))
      ) {
        return true;
      }

      // Search in plot
      if (movie.plot.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in director
      if (
        movie.directors.some((director) =>
          director.toLowerCase().includes(searchTerm)
        )
      ) {
        return true;
      }

      return false;
    })
    .slice(0, limit);
}

/**
 * Create a JSON response
 */
function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Service Worker installation
self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(self.skipWaiting());
});

// Service Worker activation
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

// Fetch interception
self.addEventListener("fetch", (event: FetchEvent) => {
  const url = new URL(event.request.url);
  const pathname = url.pathname;
  const method = event.request.method;

  // Only intercept movie API requests
  if (!pathname.startsWith("/api/movies")) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // GET /api/movies/search?query=...&limit=...
        if (pathname === "/api/movies/search" && method === "GET") {
          const query = url.searchParams.get("query") ?? "";
          const limitParam = url.searchParams.get("limit");
          const limit =
            limitParam != null ? Number.parseInt(limitParam, 10) : 500;

          const results = await searchMovies(query, limit);
          return jsonResponse(results);
        }

        // GET /api/movies/:id
        const getMovieMatch = pathname.match(/^\/api\/movies\/([^/]+)$/);
        if (getMovieMatch && method === "GET") {
          const movieId = getMovieMatch[1];
          const database = await getDatabase();
          const movie = database.find((m) => m.id === movieId);

          if (movie == null) {
            return jsonResponse(
              { error: `Movie with id ${movieId} not found` },
              404
            );
          }

          return jsonResponse(movie);
        }

        // PATCH /api/movies/:id/rating
        const updateRatingMatch = pathname.match(
          /^\/api\/movies\/([^/]+)\/rating$/
        );
        if (updateRatingMatch && method === "PATCH") {
          const movieId = updateRatingMatch[1];
          const body = (await event.request.json()) as { rating: number };

          const database = await getDatabase();
          const movie = database.find((m) => m.id === movieId);

          if (movie == null) {
            return jsonResponse(
              { error: `Movie with id ${movieId} not found` },
              404
            );
          }

          // Update rating
          const randomDecimal = Math.random() * 1.9;
          const newRating = Math.min(
            10,
            parseFloat((body.rating + randomDecimal).toFixed(1))
          );

          movie.rating = newRating;

          return jsonResponse(movie);
        }

        // Fallback: let the request pass through
        return fetch(event.request);
      } catch (error) {
        return jsonResponse(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          500
        );
      }
    })()
  );
});
