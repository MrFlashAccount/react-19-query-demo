import { useState } from "react";
import type { Movie } from "../../types/movie";
import { StarIcon } from "../shared/StarIcon";

/**
 * Movie card component using custom query library
 */
export function MovieCard({
  movie,
  onUpdateRating,
  isPending,
}: {
  movie: Movie;
  onUpdateRating: (rating: number) => void;
  isPending: boolean;
}) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  const handleStarClick = (starIndex: number) => {
    onUpdateRating(starIndex * 2);
  };

  const rating = movie.ratingsSummary.aggregateRating;
  const currentStars = Math.ceil(rating ?? 0 / 2); // Convert 0-10 rating to 0-5 stars
  const director =
    movie.principalCredits?.find((credit) => credit.category.id === "director")
      ?.credits[0]?.name.nameText.text || "Unknown";
  const genres = movie.genres.genres.map((g) => g.text).join(", ");
  const imageUrl =
    movie.primaryImage?.url ||
    "https://via.placeholder.com/300x450?text=No+Image";

  return (
    <div className="[content-visibility:auto] [contain-intrinsic-size:160px] group bg-white border-2 border-gray-100 rounded-lg overflow-hidden hover:border-black hover:shadow-lg flex flex-col sm:flex-row max-w-3xl mx-auto w-full">
      {/* Movie Image */}
      <div className="relative h-48 sm:h-36 md:h-40 w-full sm:w-auto sm:aspect-[1.5/1] flex-shrink-0 overflow-hidden bg-gray-100 sm:rounded-l-lg">
        <img
          src={imageUrl}
          alt={movie.titleText.text}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 text-xs font-bold bg-black text-white rounded-md shadow-lg">
            {rating?.toFixed(1) ?? "N/A"}
          </span>
        </div>
      </div>

      {/* Movie Info */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm sm:text-base font-bold text-black line-clamp-2 sm:truncate group-hover:text-gray-900">
            {movie.titleText.text}
          </h3>

          <div
            className={`flex items-center gap-1 text-xs text-gray-500 flex-shrink-0 ${
              isPending ? "" : "hidden"
            }`}
          >
            <div className="animate-spin h-3 w-3 border-2 border-gray-300 border-t-black rounded-full" />
            <span className="hidden sm:inline">Saving...</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" />
            </svg>
            {movie.releaseYear?.year ?? "N/A"}
          </span>
          <span className="text-gray-400">•</span>
          <span className="truncate max-w-[120px] sm:max-w-none">
            {director}
          </span>
          <span className="text-gray-400">•</span>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md truncate max-w-[150px]">
            {genres}
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

        {/* Plot */}
        {movie.plot?.plotText.plainText && (
          <div className="text-xs text-gray-600 line-clamp-2">
            {movie.plot.plotText.plainText}
          </div>
        )}
      </div>
    </div>
  );
}
