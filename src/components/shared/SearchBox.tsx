import { Settings } from "./Settings";

export function SearchBox({
  movieLimit,
  onMovieLimitChange,
  handleSearchChange,
  isPending,
}: {
  movieLimit: number;
  onMovieLimitChange: (limit: number) => void;
  handleSearchChange: (value: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="w-full max-w-6xl mb-6 md:mb-8">
      <div className="relative max-w-3xl mx-auto flex items-center gap-3">
        <Settings
          movieLimit={movieLimit}
          onMovieLimitChange={onMovieLimitChange}
        />
        <div className="relative flex-1">
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
            onChange={(e) => {
              handleSearchChange(e.target.value);
            }}
            placeholder="Search by title, director, genre, or tags..."
            className="w-full pl-10 pr-4 py-2.5 md:pl-12 md:pr-5 md:py-3 text-sm md:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black transition-all duration-200 placeholder-gray-400"
          />
          {isPending && (
            <div className="absolute inset-y-0 right-0 pr-3 md:pr-5 flex items-center">
              <div className="animate-spin h-4 w-4 md:h-5 md:w-5 border-2 border-gray-300 border-t-black rounded-full" />
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 text-center text-xs text-gray-400">
        Cached for 1 minute after last view
      </div>
    </div>
  );
}
