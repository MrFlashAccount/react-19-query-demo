import type { Movie } from "../../api/types";

export interface MovieListProps {
  movies: Movie[];
  children: (movie: Movie, index: number, movies: Movie[]) => React.ReactNode;
}

export const MOVIE_CARD_SIZE = 140;
export const MOVIE_CARD_SIZE_CSS = `${MOVIE_CARD_SIZE}px`;

/**
 * Movie list component that displays search results
 */
export function MovieList({ movies, children }: MovieListProps) {
  if (movies.length === 0) {
    return (
      <div className="text-center py-12 md:py-20">
        <div className="text-4xl md:text-6xl mb-4">🎬</div>
        <p className="text-lg md:text-xl text-gray-600 mb-2">No movies found</p>
        <p className="text-xs md:text-sm text-gray-400">Try a different search term</p>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-4 md:mb-6 text-center">
        <p className="text-xs md:text-sm text-gray-500">
          Found {movies.length} {movies.length === 1 ? "movie" : "movies"}
        </p>
      </div>

      <div className="flex flex-col gap-3 md:gap-4">{movies.map(children)}</div>
    </div>
  );
}
