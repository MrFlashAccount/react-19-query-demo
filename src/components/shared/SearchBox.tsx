import { Settings } from "./Settings";

export interface SearchBoxProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  gcTimeout: number;
  onGcTimeoutChange: (timeout: number) => void;
  movieLimit: number;
  onMovieLimitChange: (limit: number) => void;
  isPending: boolean;
  showDevtools: boolean;
  onShowDevtoolsChange: (show: boolean) => void;
}

export function SearchBox({
  gcTimeout,
  onGcTimeoutChange,
  movieLimit,
  onMovieLimitChange,
  searchQuery,
  onSearchQueryChange,
  isPending,
  showDevtools,
  onShowDevtoolsChange,
}: SearchBoxProps) {
  const gcTimeoutReadable = () => {
    if (gcTimeout === Infinity) return "forever";
    if (gcTimeout === 0) return "0 seconds";
    if (gcTimeout < 60_000) return "less than a minute";
    return `${gcTimeout / 60_000} minutes`;
  };

  return (
    <div className="w-full max-w-6xl mb-6 md:mb-8">
      <div className="relative max-w-3xl mx-auto flex items-center gap-3">
        <Settings
          gcTimeout={gcTimeout}
          showDevtools={showDevtools}
          onShowDevtoolsChange={onShowDevtoolsChange}
          onGcTimeoutChange={onGcTimeoutChange}
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
            defaultValue={searchQuery}
            onChange={(e) => {
              onSearchQueryChange(e.target.value);
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
        Cached for {gcTimeoutReadable()} after last view
      </div>
    </div>
  );
}
