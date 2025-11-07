/// <reference lib="webworker" />

type WorkerMessage =
  | {
      id: string;
      type: "searchMovies";
      payload: { query: string; limit: number };
    }
  | {
      id: string;
      type: "getMovieById";
      payload: { movieId: string };
    }
  | {
      id: string;
      type: "updateMovieRating";
      payload: { movieId: string; newRating: number };
    };

type WorkerResponse =
  | {
      id: string;
      type: "success";
      data: ArrayBuffer;
    }
  | {
      id: string;
      type: "error";
      error: string;
    };

// Handler function type
type Handler<P> = (payload: P) => Promise<ArrayBuffer>;

// Reusable wrapper to handle message processing
function createHandler<P>(
  handler: Handler<P>
): (payload: P, id: string) => Promise<void> {
  return async (payload: P, id: string) => {
    try {
      const arrayBuffer = await handler(payload);

      const successResponse: WorkerResponse = {
        id,
        type: "success",
        data: arrayBuffer,
      };

      self.postMessage(successResponse);
    } catch (error) {
      const errorResponse: WorkerResponse = {
        id,
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      };

      self.postMessage(errorResponse);
    }
  };
}

// Individual handler methods
async function handleSearchMovies(payload: {
  query: string;
  limit: number;
}): Promise<ArrayBuffer> {
  const searchParams = new URLSearchParams({
    query: payload.query,
    limit: payload.limit.toString(),
  });

  const response = await fetch(`/api/movies/search?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to search movies: ${response.statusText}`);
  }

  return response.arrayBuffer();
}

async function handleGetMovieById(payload: {
  movieId: string;
}): Promise<ArrayBuffer> {
  const response = await fetch(`/api/movies/${payload.movieId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Movie with id ${payload.movieId} not found`);
    }
    throw new Error(`Failed to get movie: ${response.statusText}`);
  }

  return response.arrayBuffer();
}

async function handleUpdateMovieRating(payload: {
  movieId: string;
  newRating: number;
}): Promise<ArrayBuffer> {
  const response = await fetch(`/api/movies/${payload.movieId}/rating`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating: payload.newRating }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Movie with id ${payload.movieId} not found`);
    }
    throw new Error(`Failed to update movie rating: ${response.statusText}`);
  }

  return response.arrayBuffer();
}

// Handler registry
const handlers = {
  searchMovies: createHandler(handleSearchMovies),
  getMovieById: createHandler(handleGetMovieById),
  updateMovieRating: createHandler(handleUpdateMovieRating),
} as const;

// Main message listener
self.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  switch (type) {
    case "searchMovies":
      await handlers.searchMovies(payload, id);
      break;
    case "getMovieById":
      await handlers.getMovieById(payload, id);
      break;
    case "updateMovieRating":
      await handlers.updateMovieRating(payload, id);
      break;
    default: {
      const errorResponse: WorkerResponse = {
        id,
        type: "error",
        error: `Unknown message type: ${type}`,
      };
      self.postMessage(errorResponse);
    }
  }
});
