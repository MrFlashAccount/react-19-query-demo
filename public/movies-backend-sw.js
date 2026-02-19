/* global self, clients */

const CACHE_SCOPE = "movies-backend-v1";
let movieDatabaseCache = null;
const scopePath = (() => {
  const pathname = new URL(self.registration.scope).pathname;
  if (pathname === "/") {
    return "";
  }
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
})();

function withScope(pathname) {
  return `${scopePath}${pathname}`;
}

function stripScope(pathname) {
  if (scopePath.length === 0) {
    return pathname;
  }
  if (!pathname.startsWith(scopePath)) {
    return pathname;
  }
  const stripped = pathname.slice(scopePath.length);
  return stripped.length > 0 ? stripped : "/";
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await clients.claim();
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((key) => key.startsWith("movies-backend-") && key !== CACHE_SCOPE)
          .map((key) => caches.delete(key)),
      );
    })(),
  );
});

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function getDatabase() {
  if (movieDatabaseCache != null) {
    return movieDatabaseCache;
  }

  const [movies1, movies2] = await Promise.all([
    fetch(withScope("/movies/1.json")).then((res) => res.json()),
    fetch(withScope("/movies/2.json")).then((res) => res.json()),
  ]);

  movieDatabaseCache = [...movies1, ...movies2].map((movie) => ({
    id: movie.id,
    titleText: movie.titleText.text,
    releaseYear: movie.releaseYear?.year ?? 0,
    genres: movie.genres.genres.map((genre) => genre.text),
    plot: movie.plot?.plotText.plainText ?? "",
    directors: [],
    rating: movie.ratingsSummary.aggregateRating ?? 0,
    image: movie.primaryImage?.url ?? "",
  }));

  return movieDatabaseCache;
}

async function searchMovies(query, limit = 500) {
  const database = await getDatabase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return database.slice(0, limit);
  }

  return database
    .filter((movie) => {
      if (movie.titleText.toLowerCase().includes(normalizedQuery)) return true;
      if (movie.genres.some((genre) => genre.toLowerCase().includes(normalizedQuery))) return true;
      if (movie.plot.toLowerCase().includes(normalizedQuery)) return true;
      if (movie.directors.some((director) => director.toLowerCase().includes(normalizedQuery))) return true;
      return false;
    })
    .slice(0, limit);
}

async function handleApiRequest(request) {
  const url = new URL(request.url);
  const pathname = stripScope(url.pathname);

  if (request.method === "GET" && pathname === "/api/movies/search") {
    const query = url.searchParams.get("query") ?? "";
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "500", 10);
    const results = await searchMovies(query, Number.isNaN(limit) ? 500 : limit);
    return jsonResponse(results);
  }

  if (request.method === "GET" && pathname.startsWith("/api/movies/")) {
    const id = pathname.slice("/api/movies/".length);
    if (!id || id.includes("/")) {
      return null;
    }

    const database = await getDatabase();
    const movie = database.find((entry) => entry.id === id);
    if (movie == null) {
      return jsonResponse({ error: `Movie with id ${id} not found` }, { status: 404 });
    }
    return jsonResponse(movie);
  }

  if (request.method === "PATCH" && pathname.endsWith("/rating")) {
    const match = pathname.match(/^\/api\/movies\/([^/]+)\/rating$/);
    if (match == null) {
      return null;
    }

    const movieId = decodeURIComponent(match[1]);
    const body = await request.json();
    const rating = typeof body?.rating === "number" ? body.rating : 0;

    const database = await getDatabase();
    const movie = database.find((entry) => entry.id === movieId);
    if (movie == null) {
      return jsonResponse({ error: `Movie with id ${movieId} not found` }, { status: 404 });
    }

    const randomDecimal = Math.random() * 1.9;
    movie.rating = Math.min(10, Number.parseFloat((rating + randomDecimal).toFixed(1)));
    return jsonResponse(movie);
  }

  return null;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const pathname = stripScope(url.pathname);
  if (!pathname.startsWith("/api/movies")) {
    return;
  }

  event.respondWith(
    handleApiRequest(request).then((response) => {
      if (response != null) {
        return response;
      }
      return jsonResponse({ error: "Not Found" }, { status: 404 });
    }),
  );
});
