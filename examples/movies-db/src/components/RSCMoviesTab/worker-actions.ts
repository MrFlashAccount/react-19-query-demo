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

export async function updateMovieRating(movieId: string, rating: number): Promise<Movie> {
  "use worker";
  const response = await fetch(withBase(`/api/movies/${encodeURIComponent(movieId)}/rating`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });

  return readJsonOrThrow<Movie>(response, "Failed to update movie rating");
}
