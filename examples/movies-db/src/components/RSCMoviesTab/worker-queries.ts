import type { Movie } from "../../api/types";

const basePath = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL.slice(0, -1)
  : import.meta.env.BASE_URL;

function withBase(path: string): string {
  return `${basePath}${path}`;
}

async function readJsonOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${fallbackMessage}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function searchMovies(searchQuery: string, limit: number): Promise<Movie[]> {
  const params = new URLSearchParams({ query: searchQuery, limit: String(limit) });

  const response = await fetch(withBase(`/api/movies/search?${params}`));
  return readJsonOrThrow<Movie[]>(response, "Failed to load movies");
}
