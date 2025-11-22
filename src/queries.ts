import { query, mutation, DependencyGraph } from "./lib/DependencyGraph";
import type { MovieApi } from "./api/types";

/**
 * Query definitions for the movie application
 */

/**
 * Query to search for movies
 */
export const moviesQuery = query({
  queryFn: async (params: {
    api: MovieApi;
    searchQuery: string;
    movieLimit: number;
  }) => {
    return params.api.searchMovies(params.searchQuery, params.movieLimit);
  },
  staleTime: 5000,
  gcTime: 60000,
});

/**
 * Query to get a single movie by ID
 */
export const movieQuery = query({
  queryFn: async (params: { api: MovieApi; movieId: string }) => {
    return params.api.getMovieById(params.movieId);
  },
  staleTime: 10000,
  gcTime: 60000,
});

/**
 * Mutation definitions for the movie application
 */

/**
 * Mutation to update a movie's rating
 */
export const updateMovieRatingMutation = mutation({
  mutationFn: async (
    params: { api: MovieApi; movieId: string },
    data: { rating: number }
  ) => {
    return params.api.updateMovieRating(params.movieId, data.rating);
  },
  // Invalidate the movies list and the specific movie after updating rating
  invalidates: [moviesQuery, movieQuery],
});

/**
 * Application dependency graph
 */
export const appGraph = new DependencyGraph([
  moviesQuery,
  movieQuery,
  updateMovieRatingMutation,
]);
