import { useTransition } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query-local";
import { MovieCard, MovieList, SearchBox } from "../shared";
import type { Movie } from "../../types/movie";
import type { Api } from "../../types/api";
import type { TabProps } from "../shared/types";

const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: 0 } },
});

export default function LocalTanStackQueryTab({
  gcTimeout,
  onGcTimeoutChange,
  movieLimit,
  onMovieLimitChange,
  devtools: Devtools,
  api,
  searchQuery,
  onSearchQueryChange,
  showDevtools,
  onShowDevtoolsChange,
}: TabProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <LocalTanStackQueryTabContent
        api={api}
        gcTimeout={gcTimeout}
        onGcTimeoutChange={onGcTimeoutChange}
        movieLimit={movieLimit}
        onMovieLimitChange={onMovieLimitChange}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        showDevtools={showDevtools}
        onShowDevtoolsChange={onShowDevtoolsChange}
        devtools={Devtools}
      />
      {Devtools && <Devtools client={queryClient} />}
    </QueryClientProvider>
  );
}

/**
 * Local TanStack Query tab component - demonstrates the local TanStack Query implementation
 */
function LocalTanStackQueryTabContent({
  gcTimeout,
  onGcTimeoutChange,
  movieLimit,
  onMovieLimitChange,
  showDevtools,
  onShowDevtoolsChange,
  searchQuery,
  onSearchQueryChange,
  api,
}: TabProps) {
  const [isPending, startTransition] = useTransition();

  const { data: movies } = useSuspenseQuery({
    queryKey: ["movies", searchQuery, movieLimit],
    queryFn: () => api.searchMovies(searchQuery, movieLimit),
    structuralSharing: false,
    gcTime: gcTimeout,
  });

  const handleSearchChange = (value: string) => {
    startTransition(() => {
      onSearchQueryChange(value);
    });
  };

  const handleMovieLimitChange = (value: number) => {
    startTransition(() => {
      onMovieLimitChange(value);
    });
  };

  const handleGcTimeoutChange = (value: number) => {
    startTransition(() => {
      onGcTimeoutChange(value);
    });
  };
  const handleShowDevtoolsChange = (value: boolean) => {
    startTransition(() => {
      onShowDevtoolsChange(value);
    });
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-4 pb-20 md:pb-60">
      <SearchBox
        gcTimeout={gcTimeout}
        onGcTimeoutChange={handleGcTimeoutChange}
        movieLimit={movieLimit}
        onMovieLimitChange={handleMovieLimitChange}
        onSearchQueryChange={handleSearchChange}
        searchQuery={searchQuery}
        isPending={isPending}
        showDevtools={showDevtools}
        onShowDevtoolsChange={handleShowDevtoolsChange}
      />
      {/* Results */}
      <div className="w-full max-w-6xl">
        <MovieList moviesAmount={movies.length}>
          {movies.map((movie) => (
            <MovieCardLocalTanStack
              key={movie.id}
              movie={movie}
              api={api}
              gcTimeout={gcTimeout}
            />
          ))}
        </MovieList>
      </div>
    </div>
  );
}

/**
 * Movie card component using local TanStack Query
 */
function MovieCardLocalTanStack({
  movie,
  api,
  gcTimeout,
}: {
  movie: Movie;
  api: Api;
  gcTimeout: number;
}) {
  const [isPending, startTransition] = useTransition();

  const movieId = movie.id;

  const queryClient = useQueryClient();

  const { mutateAsync: updateRating } = useMutation({
    mutationFn: ({ rating }: { rating: number }) =>
      api.updateMovieRating(movieId, rating),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["movies"] });
      void queryClient.invalidateQueries({
        queryKey: ["movie", movieId],
      });
    },
    gcTime: gcTimeout,
  });

  useQuery({
    queryKey: ["movie", movieId],
    queryFn: () => api.getMovieById(movieId),
    gcTime: gcTimeout,
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
