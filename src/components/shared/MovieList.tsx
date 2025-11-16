/**
 * Movie list component that displays search results
 */
export function MovieList({
  moviesAmount,
  children,
}: {
  moviesAmount: number;
  children: React.ReactNode;
}) {
  if (moviesAmount === 0) {
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
          Found {moviesAmount} {moviesAmount === 1 ? "movie" : "movies"}
        </p>
      </div>

      <div className="flex flex-col gap-3 md:gap-4">{children}</div>
    </div>
  );
}
