/**
 * RSC Movies Service Worker
 *
 * Renders movie list as React Server Components.
 * Only the star rating is interactive (client component).
 */
/// <reference lib="webworker" />

import "lib/rsc-service-worker-bff/rsc/webpack-shim";

import { setupWorker, http, json, createRSC } from "lib/rsc-service-worker-bff";
import type { Movie } from "../../api/types";
import type * as ClientComponents from "./client-components";

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

// ========== Setup RSC ==========
const { ctx, Client, ready } = createRSC<typeof ClientComponents>({
  moduleId: "rsc-movies-client",
  components: ["RatingStars"],
  actions: {
    async updateRating(movieId: unknown, rating: unknown) {
      const database = await getDatabase();
      const movie = database.find((m) => m.id === movieId);
      if (!movie) {
        throw new Error(`Movie ${movieId} not found`);
      }
      // Add some randomness like the original
      const randomDecimal = Math.random() * 1.9;
      movie.rating = Math.min(10, parseFloat(((rating as number) + randomDecimal).toFixed(1)));
      console.log("[SW] Updated rating:", movieId, "->", movie.rating);
      return movie;
    },
  },
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
          <Client.RatingStars movieId={movie.id} currentStars={currentStars} />
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
  http.get("/health", () => json({ status: "ok", timestamp: Date.now() })),

  // RSC endpoint with search params
  http.get("/rsc/movies", async ({ url }) => {
    await ready;
    const searchQuery = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? 100);

    const { renderRSC } = await import("lib/rsc-service-worker-bff/rsc/server");
    const stream = await renderRSC(<App searchQuery={searchQuery} limit={limit} />, ctx);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/x-component; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }),

  // Server actions
  http.action("/rsc/movies", ctx, { ready }),
]);

console.log("[RSC Movies SW] Routes registered");
