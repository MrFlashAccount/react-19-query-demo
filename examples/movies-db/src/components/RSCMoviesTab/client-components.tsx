/**
 * RSC Movies - Client Components
 *
 * Only interactive parts are client components.
 * Everything else renders on the server (service worker).
 */
"use main";

import { useState, useTransition } from "react";
import { callAction } from "@lib/rsc-prism/client-only";
import { updateRating } from "./worker-actions";
import { StarIcon } from "../shared";

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
  const [isPending, startTransition] = useTransition();

  const updateRatingCallback = (rating: number) => {
    startTransition(async () => {
      await callAction(updateRating, [movieId, rating]);
    });
  };

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
              onClick={() => updateRatingCallback(star * 2)}
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
