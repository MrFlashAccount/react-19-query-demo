/**
 * RSC Movies Tab
 *
 * Renders movie list via React Server Components from dedicated worker runtime.
 */
import { searchMovies, updateMovieRating } from "./worker-actions";
import { Suspense } from "react";
import { rsc, RuntimeProvider } from "@lib/rsc-prism/react";
import type { TabProps } from "../shared/types";
import { SearchBox } from "../shared";
import type { Movie } from "../../api/types";
import { RatingStars } from "./components";

export default function RSCMoviesTab({ formState, onFormStateChange, api, devtools }: TabProps) {
  return (
    <RSCMoviesTabContent
      devtools={devtools}
      formState={formState}
      onFormStateChange={onFormStateChange}
      api={api}
    />
  );
}

function RSCMoviesTabContent({ formState, onFormStateChange }: TabProps) {
  const searchQueryValue = formState.get("searchQuery");
  const searchQuery = typeof searchQueryValue === "string" ? searchQueryValue : "";
  const limit = Number(formState.get("movieLimit") ?? 100);

  return (
    <div className="flex flex-col items-center min-h-screen px-4 pb-20 md:pb-60">
      <SearchBox formState={formState} onFormStateChange={onFormStateChange} />

      <div className="w-full max-w-6xl">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin h-8 w-8 border-3 border-gray-300 border-t-black rounded-full mb-4" />
              <p className="text-sm text-gray-500">Loading movies from RSC...</p>
            </div>
          }
        >
          <RuntimeProvider>
            <MovieList searchQuery={searchQuery} limit={limit} />
          </RuntimeProvider>
        </Suspense>
      </div>
    </div>
  );
}

const MOVIE_CARD_SIZE = "140px";

export interface MovieListProps {
  searchQuery: string;
  limit: number;
}

const MovieList = rsc(async ({ searchQuery, limit }: MovieListProps) => {
  "use worker";
  const movies = await searchMovies(searchQuery, limit);

  if (movies.length === 0) {
    return (
      <div className="text-center py-12 md:py-20">
        <div className="text-4xl md:text-6xl mb-4">🎬</div>
        <p className="text-lg md:text-xl text-gray-600 mb-2">No movies found</p>
        <p className="text-xs md:text-sm text-gray-400">Try a different search term</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 md:mb-6 text-center">
        <p className="text-xs md:text-sm text-gray-500">
          Found {movies.length} {movies.length === 1 ? "movie" : "movies"}
        </p>
      </div>
      <div className="flex flex-col gap-3 md:gap-4">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </div>
  );
});

function MovieCard({ movie }: { movie: Movie }) {
  const rating = movie.rating;
  const currentStars = Math.ceil((rating ?? 0) / 2);
  const director = movie.directors.join(", ") || "Unknown";
  const genres = movie.genres.join(", ") || "Unknown";

  return (
    <div
      className="group bg-white border border-gray-100 rounded-4xl [corner-shape:superellipse(1.33)] overflow-hidden hover:border-black hover:shadow-lg flex flex-col sm:flex-row max-w-3xl mx-auto w-full"
      style={{ height: MOVIE_CARD_SIZE }}
    >
      <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm sm:text-base font-bold text-black line-clamp-2 sm:truncate group-hover:text-gray-900">
            {movie.titleText}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" />
            </svg>
            {movie.releaseYear ?? "N/A"}
          </span>
          <span className="text-gray-400">•</span>
          <span className="px-2 py-0.5 text-xs font-bold bg-black text-white rounded-md shadow-lg">
            {rating?.toFixed(1) ?? "N/A"}
          </span>
          <span className="text-gray-400">•</span>
          <span className="truncate max-w-[120px] sm:max-w-none">{director}</span>
          <span className="text-gray-400">•</span>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md truncate max-w-[150px]">
            {genres}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <RatingStars
            movieId={movie.id}
            currentStars={currentStars}
            onUpdateRating={updateMovieRating}
          />
        </div>

        {movie.plot && <div className="text-xs text-gray-600 line-clamp-2">{movie.plot}</div>}
      </div>
    </div>
  );
}
