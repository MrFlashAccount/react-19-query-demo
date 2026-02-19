import type { Movie } from "../../api/types";

async function readJsonOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${fallbackMessage}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function searchMovies(searchQuery: string, limit: number): Promise<Movie[]> {
  const params = new URLSearchParams({ query: searchQuery, limit: String(limit) });

  const response = await fetch(`/api/movies/search?${params}`);
  return readJsonOrThrow<Movie[]>(response, "Failed to load movies");
}
