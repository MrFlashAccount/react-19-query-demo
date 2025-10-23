import { useState } from "react";

const MIN_LIMIT = 1;
const MAX_LIMIT = 2000;
const LIMIT_OPTIONS = [100, 250, 500, 1000, 1500, 2000];

/**
 * Settings component for configuring movie display preferences
 */
export function Settings({
  movieLimit,
  onMovieLimitChange,
}: {
  movieLimit: number;
  onMovieLimitChange: (limit: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleLimitChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (numValue >= MIN_LIMIT && numValue <= MAX_LIMIT) {
      onMovieLimitChange(numValue);
    }
  };

  return (
    <div className="flex flex-none relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-[48px] md:h-[52px] aspect-square px-3 rounded-xl border-2 border-gray-200 hover:border-black focus:outline-none focus:border-black transition-all duration-200 bg-white text-gray-700"
        aria-label="Settings"
      >
        <svg
          className="w-5 h-5 m-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border-2 border-gray-200 p-4 w-[400px] z-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Settings</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close settings"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="movie-limit"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Number of movies to display
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="movie-limit"
                  type="range"
                  min="1"
                  max="1000"
                  value={movieLimit}
                  onChange={(e) => handleLimitChange(e.target.value)}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                />
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={movieLimit}
                  onChange={(e) => handleLimitChange(e.target.value)}
                  className="w-20 px-2 py-1 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1</span>
                <span>1000</span>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <div className="flex gap-2">
                {LIMIT_OPTIONS.map((limit) => (
                  <button
                    key={limit}
                    onClick={() => onMovieLimitChange(limit)}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                      movieLimit === limit
                        ? "bg-black text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {limit}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
