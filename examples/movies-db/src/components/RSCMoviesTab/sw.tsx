/**
 * RSC Movies Service Worker
 *
 * Renders movie list as React Server Components.
 * Only the star rating is interactive (client component).
 */
/// <reference lib="webworker" />

import "@lib/rsc-prism/runtime/webpack-shim";

import { setupWorker, http, json } from "@lib/rsc-service-worker-bff";
import { createFlightResponse, createServerAction, executeServerAction } from "@lib/rsc-prism/flight-serializer";
import type { Movie } from "../../api/types";
import { RatingStars } from "./client-components";

// ========== Movie Database ==========
let movieDatabaseCache: Movie[] | null = null;

async function getDatabase(): Promise<Movie[]> {
  if (movieDatabaseCache != null) {
    return movieDatabaseCache;
  }

  const [movies1, movies2] = await Promise.all([
    fetch("/movies/1.json").then((res) => res.json()),
    fetch("/movies/2.json").then((res) => res.json()),
  ]);

  movieDatabaseCache = [...movies1, ...movies2].map(
    (movie: any) =>
      ({
        id: movie.id,
        titleText: movie.titleText.text,
        releaseYear: movie.releaseYear?.year ?? 0,
        genres: movie.genres.genres.map((genre: { text: string }) => genre.text),
        plot: movie.plot?.plotText.plainText ?? "",
        directors: [],
        rating: movie.ratingsSummary.aggregateRating ?? 0,
        image: movie.primaryImage?.url ?? "",
      }) satisfies Movie,
  );

  return movieDatabaseCache;
}

async function searchMovies(query: string, limit: number = 500): Promise<Movie[]> {
  const database = await getDatabase();
  query = query.trim();

  if (!query) {
    return database.slice(0, limit);
  }

  const searchTerm = query.toLowerCase();
  return database
    .filter((movie) => {
      if (movie.titleText.toLowerCase().includes(searchTerm)) return true;
      if (movie.genres.some((genre) => genre.toLowerCase().includes(searchTerm))) return true;
      if (movie.plot.toLowerCase().includes(searchTerm)) return true;
      if (movie.directors.some((director) => director.toLowerCase().includes(searchTerm)))
        return true;
      return false;
    })
    .slice(0, limit);
}

// ========== Server Actions ==========
createServerAction("updateRating", async (movieId: string, rating: number): Promise<Movie> => {
  const database = await getDatabase();
  const movie = database.find((m) => m.id === movieId);
  if (!movie) {
    throw new Error(`Movie ${movieId} not found`);
  }
  // Add some randomness like the original
  const randomDecimal = Math.random() * 1.9;
  movie.rating = Math.min(10, parseFloat((rating + randomDecimal).toFixed(1)));
  console.log("[SW] Updated rating:", movieId, "->", movie.rating);
  return movie;
});

// ========== Server Components ==========

const MOVIE_CARD_SIZE = "140px";

function MovieCard({ movie }: { movie: Movie }) {
  const rating = movie.rating;
  const currentStars = Math.ceil((rating ?? 0) / 2);
  const director = movie.directors.join(", ") || "Unknown";
  const genres = movie.genres.join(", ") || "Unknown";

  return (
    <div
      className="group bg-white border border-gray-100 rounded-4xl [corner-shape:superellipse(1.33)] overflow-hidden hover:border-black hover:shadow-lg flex flex-col sm:flex-row max-w-3xl mx-auto w-full"
      style={{ height: MOVIE_CARD_SIZE }}
    >
      <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm sm:text-base font-bold text-black line-clamp-2 sm:truncate group-hover:text-gray-900">
            {movie.titleText}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" />
            </svg>
            {movie.releaseYear ?? "N/A"}
          </span>
          <span className="text-gray-400">•</span>
          <span className="px-2 py-0.5 text-xs font-bold bg-black text-white rounded-md shadow-lg">
            {rating?.toFixed(1) ?? "N/A"}
          </span>
          <span className="text-gray-400">•</span>
          <span className="truncate max-w-[120px] sm:max-w-none">{director}</span>
          <span className="text-gray-400">•</span>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md truncate max-w-[150px]">
            {genres}
          </span>
        </div>

        {/* Client Component: Interactive Star Rating */}
        <div className="flex items-center gap-2">
          <RatingStars movieId={movie.id} currentStars={currentStars} />
        </div>

        {movie.plot && <div className="text-xs text-gray-600 line-clamp-2">{movie.plot}</div>}
      </div>
    </div>
  );
}

function MovieList({ movies }: { movies: Movie[] }) {
  if (movies.length === 0) {
    return (
      <div className="text-center py-12 md:py-20">
        <div className="text-4xl md:text-6xl mb-4">🎬</div>
        <p className="text-lg md:text-xl text-gray-600 mb-2">No movies found</p>
        <p className="text-xs md:text-sm text-gray-400">Try a different search term</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 md:mb-6 text-center">
        <p className="text-xs md:text-sm text-gray-500">
          Found {movies.length} {movies.length === 1 ? "movie" : "movies"}
        </p>
      </div>
      <div className="flex flex-col gap-3 md:gap-4">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </div>
  );
}

async function App({ searchQuery, limit }: { searchQuery: string; limit: number }) {
  const movies = await searchMovies(searchQuery, limit);
  return <MovieList movies={movies} />;
}

// ========== Routes ==========
setupWorker([
  // ===== JSON API (for CustomLibraryTab & TanStackQueryTab) =====

  // GET /api/movies/search?query=...&limit=...
  http.get("/api/movies/search", async ({ url }) => {
    const query = url.searchParams.get("query") ?? "";
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam != null ? Number.parseInt(limitParam, 10) : 500;

    const results = await searchMovies(query, limit);
    return json(results);
  }),

  // GET /api/movies/:id
  http.get("/api/movies/:id", async ({ params }) => {
    const id = params.id as string;
    const database = await getDatabase();
    const movie = database.find((m) => m.id === id);

    if (movie == null) {
      return json({ error: `Movie with id ${id} not found` }, { status: 404 });
    }

    return json(movie);
  }),

  // PATCH /api/movies/:id/rating
  http.patch("/api/movies/:id/rating", async ({ params, request }) => {
    const id = params.id as string;
    const body = (await request.json()) as { rating: number };
    const database = await getDatabase();
    const movie = database.find((m) => m.id === id);

    if (movie == null) {
      return json({ error: `Movie with id ${id} not found` }, { status: 404 });
    }

    // Update rating with some randomness
    const randomDecimal = Math.random() * 1.9;
    movie.rating = Math.min(10, parseFloat((body.rating + randomDecimal).toFixed(1)));

    return json(movie);
  }),

  // ===== RSC API (for RSCMoviesTab) =====

  // GET /rsc/movies - RSC stream
  http.get("/rsc/movies", async ({ url }) => {
    const searchQuery = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? 100);
    console.log("[SW] Rendering RSC for movies:", { searchQuery, limit });
    return await createFlightResponse(<App searchQuery={searchQuery} limit={limit} />);
  }),

  // POST /rsc/movies - Server action
  http.post("/rsc/movies", async ({ request }) => {
    const actionId = request.headers.get("x-rsc-action");
    if (!actionId) {
      return json({ error: "Missing x-rsc-action header" }, { status: 400 });
    }

    console.log("[SW] Executing server action:", actionId);

    // Parse args from request body
    const body = await request.text();
    let args: unknown[] = [];
    try {
      args = JSON.parse(body);
      if (!Array.isArray(args)) args = [args];
    } catch {
      args = body ? [body] : [];
    }

    return executeServerAction(actionId, args);
  }),
]);

console.log("[Movies SW] Routes registered (JSON API + RSC)");
