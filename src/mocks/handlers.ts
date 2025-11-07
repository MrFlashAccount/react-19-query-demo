import { http, HttpResponse } from "msw";
import type { Movie } from "../types/movie";

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

  movieDatabaseCache = [...movies1, ...movies2] as Movie[];
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
      if (movie.titleText.text.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in genres
      if (
        movie.genres.genres.some((genre) =>
          genre.text.toLowerCase().includes(searchTerm)
        )
      ) {
        return true;
      }

      // Search in plot
      if (movie.plot?.plotText.plainText.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in director
      const directorCredit = movie.principalCredits?.find(
        (credit) => credit.category.id === "director"
      );
      if (
        directorCredit?.credits.some((credit) =>
          credit.name.nameText.text.toLowerCase().includes(searchTerm)
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
    const updatedMovie: Movie = {
      ...movie,
      ratingsSummary: {
        ...movie.ratingsSummary,
        aggregateRating: Math.min(
          10,
          parseFloat((body.rating + randomDecimal).toFixed(1))
        ),
      },
    };

    return HttpResponse.json(updatedMovie);
  }),
];
