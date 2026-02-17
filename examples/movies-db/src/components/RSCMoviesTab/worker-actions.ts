"use worker";

import { updateMovieRating } from "./worker-data";

export async function updateRating(movieId: string, rating: number) {
  "use worker";
  return updateMovieRating(movieId, rating);
}
