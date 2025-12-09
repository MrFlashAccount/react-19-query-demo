import { MovieList, SearchBox, MovieCard } from "../shared";
import type { Movie, MovieApi } from "../../api/types";
import type { TabProps } from "../shared/types";
import { lazy } from "react";

const {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} = await import("@tanstack/react-query");

const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: 0 } },
});

const ReactQueryDevtoolsProduction = lazy(() =>
  import("@tanstack/react-query-devtools/build/modern/production.js").then(
    (d) => ({ default: d.ReactQueryDevtools })
  )
);

export default function TanStackQueryTab({
  formState,
  onFormStateChange,
  devtools,
  api,
}: TabProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TanStackQueryTabContent
        formState={formState}
        onFormStateChange={onFormStateChange}
        api={api}
        devtools={devtools}
      />
      {devtools && <ReactQueryDevtoolsProduction client={queryClient} />}
    </QueryClientProvider>
  );
}

function TanStackQueryTabContent({
  formState,
  onFormStateChange,
  api,
}: TabProps) {
  const searchQuery = String(formState.get("searchQuery") ?? "");
  const movieLimit = Number(formState.get("movieLimit") ?? 0);
  const gcTimeout = Number(formState.get("gcTimeout") ?? 0);

  const { data: movies } = useSuspenseQuery({
    queryKey: ["movies", searchQuery, movieLimit],
    queryFn: () => api.searchMovies(searchQuery, movieLimit),
    gcTime: gcTimeout,
  });

  return (
    <div className="flex flex-col items-center min-h-screen px-4 pb-20 md:pb-60">
      <SearchBox formState={formState} onFormStateChange={onFormStateChange} />
      {/* Results */}
      <div className="w-full max-w-6xl">
        <MovieList moviesAmount={movies.length}>
          {movies.map((movie) => (
            <MovieCardTanStack
              key={movie.id}
              movie={movie}
              api={api}
              gcTimeout={gcTimeout}
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
 * Movie card component using TanStack Query
 */
function MovieCardTanStack({
  movie,
  api,
  gcTimeout,
  searchQuery,
  movieLimit,
}: {
  movie: Movie;
  api: MovieApi;
  gcTimeout: number;
  searchQuery: string;
  movieLimit: number;
}) {
  const movieId = movie.id;

  const queryClient = useQueryClient();

  const { mutateAsync: updateRating } = useMutation({
    mutationFn: ({ rating }: { rating: number }) =>
      api.updateMovieRating(movieId, rating),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: ["movies"] });
      await queryClient.invalidateQueries({ queryKey: ["movie", id] });
    },
    gcTime: gcTimeout,
  });

  useQuery({
    queryKey: ["movies", searchQuery, movieLimit],
    queryFn: () => api.searchMovies(searchQuery, movieLimit),
    gcTime: gcTimeout,
  });

  const handleStarClick = async (starIndex: number) => {
    await updateRating({ rating: starIndex * 2 });
  };

  return <MovieCard movie={movie} onUpdateRating={handleStarClick} />;
}
