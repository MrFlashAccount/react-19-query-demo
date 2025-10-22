import { useState, use, Suspense } from "react";
import { useTransition } from "react";
import { QueryProvider, useQuery, useMutation } from "./QueryProvider";
import type { Movie } from "./types/movie";
import { searchMovies, updateMovieRating } from "./api/movieApi";

/**
 * Star icon component
 */
function StarIcon({
  filled,
  className = "",
}: {
  filled: boolean;
  className?: string;
}) {
  if (filled) {
    return (
      <svg
        className={className}
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    );
  } else {
    return (
      <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    );
  }
}

export default function App() {
  return (
    <QueryProvider>
      <Suspense
        fallback={
          <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
            <div className="animate-spin h-8 w-8 md:h-10 md:w-10 border-3 border-gray-300 border-t-black rounded-full mb-4" />
            <p className="text-sm md:text-base text-gray-500">
              Loading movies...
            </p>
          </div>
        }
      >
        <div className="min-h-screen bg-white">
          <AppInternal />
        </div>
      </Suspense>
    </QueryProvider>
  );
}

function AppInternal() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isTransitioning, startTransition] = useTransition();

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-4 pt-12 pb-20 md:pt-40 md:pb-60">
      {/* Header */}
      <div className="text-center mb-8 md:mb-40">
        <h1 className="text-3xl md:text-5xl font-bold mb-2 tracking-tight">
          <span className="text-black">Movie</span>
          <span className="text-gray-400">DB</span>
        </h1>
        <p className="text-gray-500 text-xs md:text-sm">
          Search thousands of movies
        </p>
      </div>

      {/* Search Box - Same width as grid */}
      <div className="w-full max-w-6xl mb-6 md:mb-8">
        <div className="relative max-w-3xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-3 md:pl-5 flex items-center pointer-events-none">
            <svg
              className="w-4 h-4 md:w-5 md:h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            onChange={(e) =>
              startTransition(() => handleSearch(e.target.value))
            }
            placeholder="Search by title, director, genre, or tags..."
            className="w-full pl-10 pr-4 py-2.5 md:pl-12 md:pr-5 md:py-3 text-sm md:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black transition-all duration-200 placeholder-gray-400"
          />
          {isTransitioning && (
            <div className="absolute inset-y-0 right-0 pr-3 md:pr-5 flex items-center">
              <div className="animate-spin h-4 w-4 md:h-5 md:w-5 border-2 border-gray-300 border-t-black rounded-full" />
            </div>
          )}
        </div>
        <div className="mt-2 text-center text-xs text-gray-400">
          Cached for 1 minute after last view
        </div>
      </div>

      {/* Results */}
      <div className="w-full max-w-6xl">
        <MovieList query={searchQuery} />
      </div>
    </div>
  );
}

function MovieList({ query }: { query: string }) {
  const promise = useQuery({
    key: ["movies", query],
    queryFn: () => searchMovies(query),
    gcTime: 60_000,
  });

  const movies = use(promise);

  const { mutate: updateRating } = useMutation({
    mutationFn: ({ movieId, rating }: { movieId: number; rating: number }) => {
      return updateMovieRating(movieId, rating);
    },
    // Invalidate all queries starting with ['movies'] - this will refetch all movie searches
    invalidateQueries: [["movies"]],
  });

  if (movies.length === 0) {
    return (
      <div className="text-center py-12 md:py-20">
        <div className="text-4xl md:text-6xl mb-4">🎬</div>
        <p className="text-lg md:text-xl text-gray-600 mb-2">No movies found</p>
        <p className="text-xs md:text-sm text-gray-400">
          Try a different search term
        </p>
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
          <MovieCard
            key={movie.id}
            movie={movie}
            onUpdateRating={updateRating}
          />
        ))}
      </div>
    </div>
  );
}

function MovieCard({
  movie,
  onUpdateRating,
}: {
  movie: Movie;
  onUpdateRating: (variables: {
    movieId: number;
    rating: number;
  }) => Promise<Movie>;
}) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleStarClick = (starIndex: number) => {
    // Convert 1-5 stars to 2-10 rating (each star = 2 points)
    // Add random decimal between 0 and 1.9 for variety
    const baseRating = starIndex * 2;
    const randomDecimal = Math.random() * 1.9;
    const newRating = Math.min(10, baseRating + randomDecimal);

    startTransition(async () => {
      await onUpdateRating({
        movieId: movie.id,
        rating: parseFloat(newRating.toFixed(1)),
      });
    });
  };

  const currentStars = Math.ceil(movie.rating / 2); // Convert 0-10 rating to 0-5 stars

  return (
    <div className="group bg-white border-2 border-gray-100 rounded-lg overflow-hidden hover:border-black hover:shadow-lg transition-all duration-200 flex flex-col sm:flex-row max-w-3xl mx-auto w-full">
      {/* Movie Image */}
      <div className="relative h-48 sm:h-36 md:h-40 w-full sm:w-auto sm:aspect-[1.5/1] flex-shrink-0 overflow-hidden bg-gray-100 sm:rounded-l-lg">
        <img
          src={movie.image}
          alt={movie.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 text-xs font-bold bg-black text-white rounded-md shadow-lg">
            {movie.rating}
          </span>
        </div>
      </div>

      {/* Movie Info */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm sm:text-base font-bold text-black line-clamp-2 sm:truncate group-hover:text-gray-900">
            {movie.title}
          </h3>

          {isPending && (
            <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
              <div className="animate-spin h-3 w-3 border-2 border-gray-300 border-t-black rounded-full" />
              <span className="hidden sm:inline">Saving...</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" />
            </svg>
            {movie.year}
          </span>
          <span className="text-gray-400">•</span>
          <span className="truncate max-w-[120px] sm:max-w-none">
            {movie.director}
          </span>
          <span className="text-gray-400">•</span>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md">
            {movie.genre}
          </span>
        </div>

        {/* Star Rating */}
        <div className="flex items-center gap-2">
          <div
            className={`flex gap-0.5 ${
              isPending ? "opacity-75 cursor-not-allowed" : ""
            }`}
            onMouseLeave={() => setHoveredStar(null)}
          >
            {[1, 2, 3, 4, 5].map((star) => {
              const displayStar =
                hoveredStar != null
                  ? star <= hoveredStar
                  : star <= currentStars;

              return (
                <button
                  key={star}
                  onClick={() => {
                    handleStarClick(star);
                  }}
                  onMouseEnter={() => setHoveredStar(star)}
                  disabled={isPending}
                  className={`transition-all duration-150 ${
                    displayStar ? "text-yellow-400" : "text-gray-300"
                  } hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <StarIcon
                    filled={displayStar}
                    className="w-4 h-4 sm:w-5 sm:h-5"
                  />
                </button>
              );
            })}
          </div>
          <span className="text-xs text-gray-500 hidden sm:inline">
            {hoveredStar != null
              ? `Rate ${hoveredStar} star${hoveredStar > 1 ? "s" : ""}`
              : "Click to rate"}
          </span>
          <span className="text-xs text-gray-500 sm:hidden">
            {hoveredStar != null ? `${hoveredStar}★` : "Tap to rate"}
          </span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {movie.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600 rounded-md border border-gray-200"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
