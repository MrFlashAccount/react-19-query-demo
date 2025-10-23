import type { Movie } from "../types/movie";

const DEFAULT_LIMIT = 500;
let movieDatabaseCache = null as Movie[] | null;

async function getDatabase(): Promise<Movie[]> {
  movieDatabaseCache = await Promise.all([
    fetch("/movies/1.json").then((res) => res.json()),
    fetch("/movies/2.json").then((res) => res.json()),
  ]).then(([movies1, movies2]) => {
    return [...(movies1 as Movie[]), ...(movies2 as Movie[])];
  });

  return Promise.resolve(movieDatabaseCache as Movie[]);
}

async function getCachedDatabase(): Promise<Movie[]> {
  if (movieDatabaseCache != null) {
    return Promise.resolve(movieDatabaseCache);
  }

  return getDatabase();
}

/**
 * Search for movies by query string.
 * Searches in title, genres, director, and plot.
 * Simulates API call with realistic network delay (300-800ms).
 *
 * @param query - Search query string
 * @returns Promise that resolves to an array of matching movies
 */
export async function searchMovies(
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<Movie[]> {
  await Promise.resolve();
  // Simulate network delay (300-800ms)
  const delay = 300 + Math.random() * 500;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const MOVIE_DATABASE = await getDatabase();

  if (!query.trim()) {
    return MOVIE_DATABASE.slice(0, limit); // Return first limit movies for empty search
  }

  // Search in title, genres, director, and plot
  const searchTerm = query.toLowerCase();
  return MOVIE_DATABASE.filter((movie) => {
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
  }).slice(0, limit); // Limit results to limit movies
}

export async function getMovieById(movieId: string): Promise<Movie> {
  await Promise.resolve();
  const delay = 100 + Math.random() * 100;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const MOVIE_DATABASE = await getCachedDatabase();

  const movie = MOVIE_DATABASE.find((m) => m.id === movieId);

  if (movie == null) {
    throw new Error(`Movie with id ${movieId} not found`);
  }

  return movie;
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
  movieId: string,
  newRating: number
): Promise<Movie> {
  await Promise.resolve();
  // Simulate network delay (500-1000ms)
  const delay = 500 + Math.random() * 500;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const MOVIE_DATABASE = await getDatabase();

  const movie = MOVIE_DATABASE.find((m) => m.id === movieId);
  if (movie == null) {
    throw new Error(`Movie with id ${movieId} not found`);
  }

  const randomDecimal = Math.random() * 1.9;

  movie.ratingsSummary.aggregateRating = Math.min(
    10,
    parseFloat((newRating + randomDecimal).toFixed(1))
  );

  // In a real app, this would update the database
  // For this mock, we'll return a copy with the updated rating
  return movie;
}
