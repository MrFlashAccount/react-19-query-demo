import type { Movie } from "../types/movie";
import { MOVIE_DATABASE } from "../mocks/movieDatabase";

/**
 * Search for movies by query string.
 * Searches in title, director, genre, and tags.
 * Simulates API call with realistic network delay (300-800ms).
 *
 * @param query - Search query string
 * @returns Promise that resolves to an array of matching movies
 */
export async function searchMovies(query: string): Promise<Movie[]> {
  // Simulate network delay (300-800ms)
  const delay = 300 + Math.random() * 500;
  await new Promise((resolve) => setTimeout(resolve, delay));

  if (!query.trim()) {
    return MOVIE_DATABASE;
  }

  // Search in title, director, genre, and tags
  const searchTerm = query.toLowerCase();
  return MOVIE_DATABASE.filter(
    (movie) =>
      movie.title.toLowerCase().includes(searchTerm) ||
      movie.director.toLowerCase().includes(searchTerm) ||
      movie.genre.toLowerCase().includes(searchTerm) ||
      movie.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
  );
}

/**
 * Update a movie's rating.
 * Simulates API call with realistic network delay (500-1000ms).
 *
 * @param movieId - ID of the movie to update
 * @param newRating - New rating value
 * @returns Promise that resolves to the updated movie
 */
export async function updateMovieRating(
  movieId: number,
  newRating: number
): Promise<Movie> {
  // Simulate network delay (500-1000ms)
  const delay = 500 + Math.random() * 500;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const movie = MOVIE_DATABASE.find((m) => m.id === movieId);
  if (movie == null) {
    throw new Error(`Movie with id ${movieId} not found`);
  }

  movie.rating = newRating;

  // In a real app, this would update the database
  // For this mock, we'll return a copy with the updated rating
  return {
    ...movie,
    rating: newRating,
  };
}
