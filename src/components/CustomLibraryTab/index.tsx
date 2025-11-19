import { Suspense, use } from "react";
import { QueryClient, QueryProvider, useMutation, useQuery } from "../../lib";
import { MovieList, Loader, MovieCard, SearchBox } from "../shared";
import type { Movie } from "../../api/types";
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
      <Suspense fallback={<Loader />}>
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
            <MovieCardCustom
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
 * Movie card component using custom query library
 */
function MovieCardCustom({
  movie,
  api,
  gcTimeout,
  searchQuery,
  movieLimit,
}: {
  movie: Movie;
  api: TabProps["api"];
  gcTimeout: number;
  searchQuery: string;
  movieLimit: number;
}) {
  const movieId = movie.id;

  const { mutate: updateRating, isPending } = useMutation({
    mutationFn: ({ rating }: { rating: number }) =>
      api.updateMovieRating(movieId, rating),
    // Invalidate all queries starting with ['movies'] - this will refetch all movie searches
    invalidateQueries: [["movies"], ["movie", movieId]],
  });

  useQuery({
    key: ["movies", searchQuery, movieLimit],
    queryFn: ([, query]) => api.searchMovies(query, movieLimit),
    gcTime: gcTimeout,
  });

  return (
    <MovieCard
      movie={movie}
      onUpdateRating={(rating) => {
        void updateRating({ rating });
      }}
      isPending={isPending}
    />
  );
}
