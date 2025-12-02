import { use } from "react";
import { QueryClient, QueryProvider, useMutation, useQuery } from "../../lib";
import { MovieList, MovieCard, SearchBox } from "../shared";
import type { Movie } from "../../api/types";
import type { TabProps } from "../shared/types";
import {
  appGraph,
  moviesQuery,
  updateMovieRatingMutation,
} from "../../queries";

const queryClient = new QueryClient({ graph: appGraph });

export default function CustomLibraryTab({
  formState,
  onFormStateChange,
  api,
  devtools,
}: TabProps<{}>) {
  return (
    <QueryProvider queryClient={queryClient} context={{ api }}>
      <CustomLibraryTabContent
        api={api}
        formState={formState}
        onFormStateChange={onFormStateChange}
        devtools={devtools}
      />
    </QueryProvider>
  );
}

/**
 * Custom library tab component - demonstrates the custom query library implementation
 */
function CustomLibraryTabContent({
  formState,
  onFormStateChange,
  devtools: Devtools,
}: TabProps<{}>) {
  const searchQuery = String(formState.get("searchQuery") ?? "");
  const movieLimit = Number(formState.get("movieLimit") ?? 0);

  const { promise } = useQuery({
    query: moviesQuery,
    params: { searchQuery, movieLimit },
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
              searchQuery={searchQuery}
              movieLimit={movieLimit}
            />
          ))}
        </MovieList>
      </div>

      {Devtools && <Devtools />}
    </div>
  );
}

/**
 * Movie card component using custom query library
 */
function MovieCardCustom({
  movie,
  searchQuery,
  movieLimit,
}: {
  movie: Movie;
  searchQuery: string;
  movieLimit: number;
}) {
  const movieId = movie.id;

  const { mutate: updateRating } = useMutation({
    mutation: updateMovieRatingMutation,
  });

  // Subscribe to movies query just to add some overhead
  useQuery({
    query: moviesQuery,
    params: { searchQuery, movieLimit },
  });

  return (
    <MovieCard
      movie={movie}
      onUpdateRating={async (rating) => {
        await updateRating({ movieId, rating });
      }}
    />
  );
}
