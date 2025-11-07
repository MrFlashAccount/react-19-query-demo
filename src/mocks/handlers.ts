import { http, HttpResponse } from "msw";
import type { Movie, RawMovie } from "../types/movie";

let movieDatabaseCache: Movie[] | null = null;

/**
 * Load the movie database from JSON files
 */
async function getDatabase(): Promise<Movie[]> {
  if (movieDatabaseCache != null) {
    return movieDatabaseCache;
  }

  const [movies1, movies2] = await Promise.all([
    fetch("/movies/1.json").then((res) => res.json() as Promise<RawMovie[]>),
    fetch("/movies/2.json").then((res) => res.json() as Promise<RawMovie[]>),
  ]);

  movieDatabaseCache = [...movies1, ...movies2].map((movie) => ({
    id: movie.id,
    titleText: movie.titleText.text,
    releaseYear: movie.releaseYear?.year ?? 0,
    rating: movie.ratingsSummary.aggregateRating ?? 0,
    genres: movie.genres.genres.map((genre) => genre.text),
    plot: movie.plot?.plotText.plainText ?? "",
    directors:
      movie.principalCredits
        ?.find((credit) => credit.category.id === "director")
        ?.credits.map((credit) => credit.name.nameText.text) ?? [],
    image: movie.primaryImage?.url ?? "",
  }));

  return movieDatabaseCache ?? [];
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
 * MSW request handlers for movie API
 */
export const handlers = [
  /**
   * Search movies endpoint
   * GET /api/movies/search?query=...&limit=...
   */
  http.get("/api/movies/search", async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") ?? "";
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam != null ? Number.parseInt(limitParam, 10) : 500;

    const results = await searchMovies(query, limit);
    return HttpResponse.json(results);
  }),

  /**
   * Get movie by ID endpoint
   * GET /api/movies/:id
   */
  http.get("/api/movies/:id", async ({ params }) => {
    const { id } = params;

    const database = await getDatabase();
    const movie = database.find((m) => m.id === id);

    if (movie == null) {
      return HttpResponse.json(
        { error: `Movie with id ${id} not found` },
        { status: 404 }
      );
    }

    return HttpResponse.json(movie);
  }),

  /**
   * Update movie rating endpoint
   * PATCH /api/movies/:id/rating
   */
  http.patch("/api/movies/:id/rating", async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as { rating: number };

    const database = await getDatabase();
    const movie = database.find((m) => m.id === id);

    if (movie == null) {
      return HttpResponse.json(
        { error: `Movie with id ${id} not found` },
        { status: 404 }
      );
    }

    // Update rating
    const randomDecimal = Math.random() * 1.9;
    const newRating = Math.min(
      10,
      parseFloat((body.rating + randomDecimal).toFixed(1))
    );
    movie.rating = newRating;

    return HttpResponse.json(movie);
  }),
];
