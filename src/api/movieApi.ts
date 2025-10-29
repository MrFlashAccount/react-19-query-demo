import type { Movie } from "../types/movie";

const DEFAULT_LIMIT = 500;

/**
 * Search for movies by query string.
 * Uses MSW to mock API calls in development.
 *
 * @param query - Search query string
 * @param limit - Maximum number of results to return
 * @returns Promise that resolves to an array of matching movies
 */
export async function searchMovies(
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<Movie[]> {
  const searchParams = new URLSearchParams({
    query,
    limit: limit.toString(),
  });

  const response = await fetch(`/api/movies/search?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to search movies: ${response.statusText}`);
  }

  return response.json() as Promise<Movie[]>;
}

/**
 * Get a movie by its ID.
 * Uses MSW to mock API calls in development.
 *
 * @param movieId - ID of the movie to fetch
 * @returns Promise that resolves to the movie
 */
export async function getMovieById(movieId: string): Promise<Movie> {
  const response = await fetch(`/api/movies/${movieId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Movie with id ${movieId} not found`);
    }
    throw new Error(`Failed to get movie: ${response.statusText}`);
  }

  return response.json() as Promise<Movie>;
}

/**
 * Update a movie's rating.
 * Uses MSW to mock API calls in development.
 *
 * @param movieId - ID of the movie to update
 * @param newRating - New rating value
 * @returns Promise that resolves to the updated movie
 */
export async function updateMovieRating(
  movieId: string,
  newRating: number
): Promise<Movie> {
  const response = await fetch(`/api/movies/${movieId}/rating`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rating: newRating }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Movie with id ${movieId} not found`);
    }
    throw new Error(`Failed to update movie rating: ${response.statusText}`);
  }

  return response.json() as Promise<Movie>;
}
