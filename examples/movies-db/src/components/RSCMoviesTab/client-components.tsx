/**
 * RSC Movies - Client Components
 *
 * Only interactive parts are client components.
 * Everything else renders on the server (service worker).
 */
"use main";

import { useState } from "react";
import { useMutation } from "@lib/goat-query/react";
import { rscUpdateMovieRatingMutation } from "../../queries";

// Star icon component
function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      viewBox="0 0 24 24"
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

export interface RatingStarsProps {
  movieId: string;
  currentStars: number;
}

/**
 * Interactive star rating component
 * Calls server action to update rating
 */
export function RatingStars({ movieId, currentStars }: RatingStarsProps) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  const { mutate: updateRating, isPending } = useMutation({
    mutation: rscUpdateMovieRatingMutation,
  });

  return (
    <>
      <div
        className={`flex gap-0.5 ${isPending ? "opacity-75 cursor-not-allowed" : ""}`}
        onMouseLeave={() => setHoveredStar(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const showFilled = hoveredStar != null ? star <= hoveredStar : star <= currentStars;

          return (
            <button
              key={star}
              onClick={() => updateRating({ movieId, rating: star * 2 })}
              onMouseEnter={() => setHoveredStar(star)}
              disabled={isPending}
              className={`transition-all duration-150 ${
                showFilled ? "text-yellow-400" : "text-gray-300"
              } hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <StarIcon filled={showFilled} className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          );
        })}
      </div>

      {isPending && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <div className="animate-spin h-3 w-3 border-2 border-gray-300 border-t-black rounded-full" />
          <span className="hidden sm:inline">Saving...</span>
        </div>
      )}

      {!isPending && (
        <span className="text-xs text-gray-500 hidden sm:inline">
          {hoveredStar != null
            ? `Rate ${hoveredStar} star${hoveredStar > 1 ? "s" : ""}`
            : "Click to rate"}
        </span>
      )}
    </>
  );
}
