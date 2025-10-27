import { use } from "react";
import { QueryCache, QueryProvider, useMutation, useQuery } from "../../lib";
import { MovieList } from "../shared/MovieList";
import { SearchBox } from "../shared/SearchBox";
import { MovieCard } from "../shared/MovieCard";
import type { Movie } from "../../types/movie";
import type { Api } from "../../types/api";
import type { TabProps } from "../shared/types";

const queryCache = new QueryCache();

export default function CustomLibraryTab({
  gcTimeout,
  onGcTimeoutChange,
  movieLimit,
  onMovieLimitChange,
  api,
  searchQuery,
  onSearchQueryChange,
  showDevtools,
  onShowDevtoolsChange,
}: TabProps) {
  return (
    <QueryProvider queryCache={queryCache}>
      <CustomLibraryTabContent
        devtools={null}
        gcTimeout={gcTimeout}
        onGcTimeoutChange={onGcTimeoutChange}
        movieLimit={movieLimit}
        onMovieLimitChange={onMovieLimitChange}
        api={api}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        showDevtools={showDevtools}
        onShowDevtoolsChange={onShowDevtoolsChange}
      />
    </QueryProvider>
  );
}

/**
 * Custom library tab component - demonstrates the custom query library implementation
 */
function CustomLibraryTabContent({
  gcTimeout,
  onGcTimeoutChange,
  movieLimit,
  onMovieLimitChange,
  api,
  searchQuery,
  onSearchQueryChange,
  showDevtools,
  onShowDevtoolsChange,
}: TabProps) {
  const { promise, isPending } = useQuery({
    key: ["movies", searchQuery, movieLimit],
    queryFn: ([, query]) => api.searchMovies(query, movieLimit),
    gcTime: gcTimeout,
  });

  const movies = use(promise());

  return (
    <div className="flex flex-col items-center min-h-screen px-4 pb-20 md:pb-60">
      {/* Search Box */}
      <SearchBox
        gcTimeout={gcTimeout}
        onGcTimeoutChange={onGcTimeoutChange}
        movieLimit={movieLimit}
        onMovieLimitChange={onMovieLimitChange}
        onSearchQueryChange={onSearchQueryChange}
        searchQuery={searchQuery}
        isPending={isPending}
        showDevtools={showDevtools}
        onShowDevtoolsChange={onShowDevtoolsChange}
      />

      {/* Results */}
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
    queryFn: () => api.getMovieById(movieId),
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
