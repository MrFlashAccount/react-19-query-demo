import type { MovieApi } from "./api/types";
import { query, mutation, DependencyGraph } from "lib/goat-query/react";

/**
 * Query definitions for the movie application
 */

/**
 * Query to search for movies
 */
export const moviesQuery = query({
  queryFn: (params: { searchQuery: string; movieLimit: number }, ctx) =>
    ctx.api.searchMovies(params.searchQuery, params.movieLimit),
  staleTime: 5000,
  gcTime: 60000,
});

/**
 * Query to get a single movie by ID
 */
export const movieQuery = query({
  queryFn: (params: { movieId: string }, ctx) => ctx.api.getMovieById(params.movieId),
  staleTime: 10000,
  gcTime: 60000,
});

export const rscMoviesQuery = query({
  queryFn: (params: { searchQuery: string; limit: number }, ctx) =>
    ctx.api.searchMoviesRSC(params.searchQuery, params.limit),
  staleTime: 5000,
  gcTime: 60000,
});

export const rscUpdateMovieRatingMutation = mutation({
  mutationFn: (params: { movieId: string; rating: number }, ctx) =>
    ctx.api.updateMovieRatingRSC(params.movieId, params.rating),
  invalidates: [rscMoviesQuery],
});

/**
 * Mutation definitions for the movie application
 */

/**
 * Mutation to update a movie's rating
 */
export const updateMovieRatingMutation = mutation({
  mutationFn: (params: { movieId: string; rating: number }, ctx) =>
    ctx.api.updateMovieRating(params.movieId, params.rating),
  invalidates: [moviesQuery, movieQuery],
});

/**
 * Application dependency graph
 */
export const appGraph = new DependencyGraph([
  moviesQuery,
  movieQuery,
  updateMovieRatingMutation,
  rscMoviesQuery,
  rscUpdateMovieRatingMutation,
]);

declare module "lib/goat-query/react" {
  interface Context {
    api: MovieApi;
  }
}
