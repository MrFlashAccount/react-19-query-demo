import { useQuery, useMutation } from "../../lib";
import type { Movie } from "../../types/movie";
import { getMovieById, updateMovieRating } from "../../api/movieApi";
import { MovieCard } from "../shared/MovieCard";

/**
 * Movie card component using custom query library
 */
export function MovieCardCustom({ movie }: { movie: Movie }) {
  const movieId = movie.id;

  const { mutate: updateRating, isPending } = useMutation({
    mutationFn: ({ rating }: { rating: number }) =>
      updateMovieRating(movieId, rating),
    // Invalidate all queries starting with ['movies'] - this will refetch all movie searches
    invalidateQueries: [["movies"], ["movie", movieId]],
  });

  useQuery({
    key: ["movie", movieId],
    queryFn: () => getMovieById(movieId),
    gcTime: 60_000,
  });

  return (
    <MovieCard
      movie={movie}
      onUpdateRating={(rating) => void updateRating({ rating })}
      isPending={isPending}
    />
  );
}
