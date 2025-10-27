import type { Movie } from "./movie";

export interface Api {
  getMovieById: (movieId: string) => Promise<Movie>;
  searchMovies: (query: string, limit: number) => Promise<Movie[]>;
  updateMovieRating: (movieId: string, newRating: number) => Promise<Movie>;
}
