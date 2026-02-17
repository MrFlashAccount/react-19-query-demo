import type { Movie } from "../../api/types";

async function readJsonOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${fallbackMessage}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function searchMovies(searchQuery: string, limit: number): Promise<Movie[]> {
  const params = new URLSearchParams({
    query: searchQuery,
    limit: String(limit),
  });

  const response = await fetch(`/api/movies/search?${params}`);
  return readJsonOrThrow<Movie[]>(response, "Failed to load movies");
}

export async function updateMovieRating(movieId: string, rating: number): Promise<Movie> {
  const response = await fetch(`/api/movies/${encodeURIComponent(movieId)}/rating`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });

  return readJsonOrThrow<Movie>(response, "Failed to update movie rating");
}
