import { use, useState } from "react";
import { useMutation, useQuery } from "../../lib";
import {
  getMovieById,
  searchMovies,
  updateMovieRating,
} from "../../api/movieApi";
import { MovieList } from "../shared/MovieList";
import { SearchBox } from "../shared/SearchBox";
import { MovieCard } from "../shared/MovieCard";
import type { Movie } from "../../types/movie";

/**
 * Custom library tab component - demonstrates the custom query library implementation
 */
export function CustomLibraryTab({
  movieLimit,
  onMovieLimitChange,
}: {
  movieLimit: number;
  onMovieLimitChange: (limit: number) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const { promise, isPending } = useQuery({
    key: ["movies", searchQuery, movieLimit],
    queryFn: ([, query]) => searchMovies(query, movieLimit),
    gcTime: 0,
  });

  const movies = use(promise!);

  return (
    <div className="flex flex-col items-center min-h-screen px-4 pb-20 md:pb-60">
      {/* Search Box */}
      <SearchBox
        movieLimit={movieLimit}
        onMovieLimitChange={onMovieLimitChange}
        handleSearchChange={setSearchQuery}
        isPending={isPending}
      />

      {/* Results */}
      <div className="w-full max-w-6xl">
        <MovieList moviesAmount={movies.length}>
          {movies.map((movie) => (
            <MovieCardCustom
              key={movie.id}
              movie={movie}
              searchQuery={searchQuery}
              movieLimit={movieLimit}
            />
          ))}
        </MovieList>
      </div>
    </div>
  );
}

/**
 * Movie card component using custom query library
 */
export function MovieCardCustom({
  movie,
  searchQuery,
  movieLimit,
}: {
  movie: Movie;
  searchQuery: string;
  movieLimit: number;
}) {
  const movieId = movie.id;

  const { mutate: updateRating, isPending } = useMutation({
    mutationFn: ({ rating }: { rating: number }) =>
      updateMovieRating(movieId, rating),
    invalidateQueries: [["movies"], ["movie", movieId]],
  });

  useQuery({
    key: ["movie", movieId],
    queryFn: ([, movieId]) => getMovieById(movieId),
    gcTime: 0,
  });

  return (
    <MovieCard
      movie={movie}
      onUpdateRating={(rating) => {
        updateRating({ rating });
      }}
      isPending={isPending}
    />
  );
}
