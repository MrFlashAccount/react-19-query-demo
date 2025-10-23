import { useTransition } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Movie } from "../../types/movie";
import { getMovieById, updateMovieRating } from "../../api/movieApi";
import { MovieCard } from "../shared/MovieCard";

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
