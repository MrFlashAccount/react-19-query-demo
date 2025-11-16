import { Suspense, use } from "react";
import { QueryClient, QueryProvider, useMutation, useQuery } from "../../lib";
import { MovieList } from "../shared/MovieList";
import { SearchBox } from "../shared/SearchBox";
import { MovieCard } from "../shared/MovieCard";
import type { Movie } from "../../types/movie";
import type { Api } from "../../types/api";
import type { TabProps } from "../shared/types";

const queryClient = new QueryClient();

export default function CustomLibraryTab({
  formState,
  onFormStateChange,
  api,
  devtools,
}: TabProps) {
  return (
    <QueryProvider queryClient={queryClient}>
      <Suspense fallback={<div>Loading...</div>}>
        <CustomLibraryTabContent
          formState={formState}
          onFormStateChange={onFormStateChange}
          api={api}
          devtools={devtools}
        />
      </Suspense>
    </QueryProvider>
  );
}

/**
 * Custom library tab component - demonstrates the custom query library implementation
 */
function CustomLibraryTabContent({
  formState,
  onFormStateChange,
  api,
}: TabProps) {
  const searchQuery = String(formState.get("searchQuery") ?? "");
  const movieLimit = Number(formState.get("movieLimit") ?? 0);
  const gcTimeout = Number(formState.get("gcTimeout") ?? 0);

  const { promise } = useQuery({
    key: ["movies", searchQuery, movieLimit],
    queryFn: ([, query]) => api.searchMovies(query, movieLimit),
    gcTime: gcTimeout,
  });

  const movies = use(promise);

  return (
    <div className="flex flex-col items-center min-h-screen px-4 pb-20 md:pb-60">
      <SearchBox formState={formState} onFormStateChange={onFormStateChange} />

      <div className="w-full max-w-6xl">
        <MovieList moviesAmount={movies.length}>
          {movies.map((movie) => (
            <MovieCardCustom key={movie.id} movie={movie} api={api} />
          ))}
        </MovieList>
      </div>
    </div>
  );
}

/**
 * Movie card component using custom query library
 */
function MovieCardCustom({ movie, api }: { movie: Movie; api: Api }) {
  const movieId = movie.id;

  const { mutate: updateRating, isPending } = useMutation({
    mutationFn: ({ rating }: { rating: number }) =>
      api.updateMovieRating(movieId, rating),
    // Invalidate all queries starting with ['movies'] - this will refetch all movie searches
    invalidateQueries: [["movies"], ["movie", movieId]],
  });

  useQuery({
    key: ["movie", movieId],
    queryFn: ([, movieId]) => api.getMovieById(movieId),
    gcTime: 60_000,
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
