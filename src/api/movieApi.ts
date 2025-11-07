import type { Movie } from "../types/movie";

const DEFAULT_LIMIT = 500;
const decoder = new TextDecoder();
let worker: Worker | null = null;

// Register custom Service Worker for API interception
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/movieApi.service-worker.js", { scope: "/" })
    .catch((error) => {
      console.error("Failed to register service worker:", error);
    });
}

async function getWorker(): Promise<Worker> {
  if (worker == null) {
    worker = await import("./movieApi.worker.ts?worker").then(
      (module) => new module.default()
    );
  }

  return worker!;
}

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

function sendWorkerMessage<T>(
  type: WorkerMessage["type"],
  payload: WorkerMessage["payload"]
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const worker = await getWorker();
    const id = `${Date.now()}-${Math.random()}`;

    const messageHandler = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) {
        return;
      }

      worker.removeEventListener("message", messageHandler);

      if (event.data.type === "error") {
        reject(new Error(event.data.error));
      } else {
        let start = performance.now();
        const jsonString = decoder.decode(event.data.data);
        let end = performance.now();
        performance.measure(`${type}-response-${id}-decode`, {
          start,
          end,
        });

        start = performance.now();
        const parsed = JSON.parse(jsonString);
        end = performance.now();
        performance.measure(`${type}-response-${id}-parse`, {
          start,
          end,
        });

        resolve(parsed as T);
      }
    };

    worker.addEventListener("message", messageHandler);

    const message: WorkerMessage = {
      id,
      type,
      payload,
    } as WorkerMessage;

    worker.postMessage(message);
  });
}

/**
 * Search for movies by query string.
 * Uses MSW to mock API calls in development.
 * API calls are performed in a Web Worker, with responses returned as ArrayBuffers.
 *
 * @param query - Search query string
 * @param limit - Maximum number of results to return
 * @returns Promise that resolves to an array of matching movies
 */
export async function searchMovies(
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<Movie[]> {
  return sendWorkerMessage<Movie[]>("searchMovies", { query, limit });
}

/**
 * Get a movie by its ID.
 * Uses MSW to mock API calls in development.
 * API calls are performed in a Web Worker, with responses returned as ArrayBuffers.
 *
 * @param movieId - ID of the movie to fetch
 * @returns Promise that resolves to the movie
 */
export async function getMovieById(movieId: string): Promise<Movie> {
  return sendWorkerMessage<Movie>("getMovieById", { movieId });
}

/**
 * Update a movie's rating.
 * Uses MSW to mock API calls in development.
 * API calls are performed in a Web Worker, with responses returned as ArrayBuffers.
 *
 * @param movieId - ID of the movie to update
 * @param newRating - New rating value
 * @returns Promise that resolves to the updated movie
 */
export async function updateMovieRating(
  movieId: string,
  newRating: number
): Promise<Movie> {
  return sendWorkerMessage<Movie>("updateMovieRating", { movieId, newRating });
}
