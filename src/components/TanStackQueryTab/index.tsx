import { useState, useTransition } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  getMovieById,
  searchMovies,
  updateMovieRating,
} from "../../api/movieApi";
import { MovieList } from "../shared/MovieList";
import { SearchBox } from "../shared/SearchBox";
import type { Movie } from "../../types/movie";
import { MovieCard } from "../shared/MovieCard";

/**
 * TanStack Query tab component - demonstrates the TanStack Query implementation
 */
export function TanStackQueryTab({
  movieLimit,
  onMovieLimitChange,
}: {
  movieLimit: number;
  onMovieLimitChange: (limit: number) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: movies } = useSuspenseQuery({
    queryKey: ["tanstack-movies", searchQuery, movieLimit],
    queryFn: () => searchMovies(searchQuery, movieLimit),
  });

  const handleSearchChange = (value: string) => {
    startTransition(() => {
      setSearchQuery(value);
    });
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-4 pb-20 md:pb-60">
      <SearchBox
        movieLimit={movieLimit}
        onMovieLimitChange={onMovieLimitChange}
        handleSearchChange={handleSearchChange}
        isPending={isPending}
      />
      {/* Results */}
      <div className="w-full max-w-6xl">
        <MovieList moviesAmount={movies.length}>
          {movies.map((movie) => (
            <MovieCardTanStack key={movie.id} movie={movie} />
          ))}
        </MovieList>
      </div>
    </div>
  );
}

/**
 * Movie card component using TanStack Query
 */
export function MovieCardTanStack({ movie }: { movie: Movie }) {
  const [isPending, startTransition] = useTransition();

  const movieId = movie.id;

  const queryClient = useQueryClient();

  const { mutateAsync: updateRating } = useMutation({
    mutationFn: ({ rating }: { rating: number }) =>
      updateMovieRating(movieId, rating),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["movies"] });
      void queryClient.invalidateQueries({
        queryKey: ["movie", movieId],
      });
    },
  });

  useQuery({
    queryKey: ["movie", movieId],
    queryFn: () => getMovieById(movieId),
  });

  const handleStarClick = (starIndex: number) => {
    startTransition(async () => {
      await updateRating({ rating: starIndex * 2 });
    });
  };

  return (
    <MovieCard
      movie={movie}
      onUpdateRating={handleStarClick}
      isPending={isPending}
    />
  );
}
