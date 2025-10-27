import { useTransition } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { MovieList, SearchBox, MovieCard } from "../shared";
import type { Movie } from "../../types/movie";
import type { Api } from "../../types/api";
import type { TabProps } from "../shared/types";

const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: 0 } },
});

export default function TanStackQueryTab({
  gcTimeout,
  onGcTimeoutChange,
  movieLimit,
  onMovieLimitChange,
  searchQuery,
  onSearchQueryChange,
  showDevtools,
  onShowDevtoolsChange,
  devtools: Devtools,
  api,
}: TabProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TanStackQueryTabContent
        gcTimeout={gcTimeout}
        onGcTimeoutChange={onGcTimeoutChange}
        movieLimit={movieLimit}
        onMovieLimitChange={onMovieLimitChange}
        api={api}
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

function TanStackQueryTabContent({
  movieLimit,
  onMovieLimitChange,
  api,
  gcTimeout,
  onGcTimeoutChange,
  searchQuery,
  onSearchQueryChange,
  showDevtools,
  onShowDevtoolsChange,
}: TabProps) {
  const [isPending, startTransition] = useTransition();

  const { data: movies } = useSuspenseQuery({
    queryKey: ["movies", searchQuery, movieLimit],
    queryFn: () => api.searchMovies(searchQuery, movieLimit),
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
        isPending={isPending}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchChange}
        showDevtools={showDevtools}
        onShowDevtoolsChange={handleShowDevtoolsChange}
      />
      {/* Results */}
      <div className="w-full max-w-6xl">
        <MovieList moviesAmount={movies.length}>
          {movies.map((movie) => (
            <MovieCardTanStack
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
 * Movie card component using TanStack Query
 */
function MovieCardTanStack({
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
