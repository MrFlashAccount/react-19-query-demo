/**
 * RSC Client Module - For Main Thread
 *
 * Provides utilities for consuming RSC streams and calling server actions.
 *
 * IMPORTANT: Import webpack-shim before this module:
 * ```ts
 * import './rsc/webpack-shim';
 * import { consumeRSC } from './rsc/client';
 * ```
 */

import type { EncodedActionArgs } from "./types";

/**
 * Wait for service worker to be controlling the page.
 * Resolves when the SW is active AND has claimed this client.
 *
 * @example
 * ```ts
 * await ensureWorkerReady();
 * // Now safe to make requests that the SW will intercept
 * ```
 */
export async function ensureWorkerReady(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Workers not supported");
  }

  await navigator.serviceWorker.ready;

  // If already controlled, we're good
  if (navigator.serviceWorker.controller) {
    return;
  }

  // Wait for controller to be set (after clients.claim())
  await new Promise<void>((resolve) => {
    const onChange = () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    // Check again in case it was set between ready and addEventListener
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      resolve();
    }
  });
}

// Lazy imports to ensure webpack-shim loads first
let _createFromReadableStream: typeof import("react-server-dom-webpack/client").createFromReadableStream;
let _encodeReply: typeof import("react-server-dom-webpack/client").encodeReply;

async function ensureImports(): Promise<void> {
  if (!_createFromReadableStream) {
    const mod = await import("react-server-dom-webpack/client");
    _createFromReadableStream = mod.createFromReadableStream;
    _encodeReply = mod.encodeReply;
  }
}

/**
 * Options for consuming an RSC stream
 */
export interface ConsumeRSCOptions {
  /**
   * Function to call server actions
   * Required if the RSC payload contains server action references
   */
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>;
}

/**
 * Consume an RSC stream and return the React element tree
 *
 * @example
 * ```ts
 * const response = await fetch('/rsc');
 * const element = await consumeRSC(response.body!);
 * root.render(element);
 * ```
 */
export async function consumeRSC<T = unknown>(
  stream: ReadableStream<Uint8Array>,
  options?: ConsumeRSCOptions,
): Promise<T> {
  await ensureImports();
  return _createFromReadableStream<T>(
    stream,
    options?.callServer ? { callServer: options.callServer } : {},
  );
}

/**
 * Consume an RSC Response and return the React element tree
 */
export async function consumeRSCResponse<T = unknown>(
  response: Response,
  options?: ConsumeRSCOptions,
): Promise<T> {
  if (!response.body) {
    throw new Error("Response has no body");
  }
  return consumeRSC<T>(response.body, options);
}

/**
 * Encode action arguments for sending to the server
 *
 * @example
 * ```ts
 * const encoded = await encodeActionArgs([count, { increment: true }]);
 * const response = await fetch('/rsc/action', {
 *   method: 'POST',
 *   body: encoded.data,
 *   headers: { 'x-rsc-action': 'incrementCount' }
 * });
 * ```
 */
export async function encodeActionArgs(args: unknown[]): Promise<EncodedActionArgs> {
  await ensureImports();
  const encoded = await _encodeReply(args);

  if (encoded instanceof FormData) {
    return {
      type: "formdata",
      data: new URLSearchParams(encoded as unknown as Record<string, string>).toString(),
    };
  }

  return { type: "string", data: encoded as string };
}

/**
 * Create a callServer function for use with consumeRSC
 *
 * @example
 * ```ts
 * const callServer = createCallServer('/rsc/action');
 * const element = await consumeRSC(stream, { callServer });
 * ```
 */
export function createCallServer(
  actionEndpoint: string,
  options?: RequestInit,
): (actionId: string, args: unknown[]) => Promise<unknown> {
  const callServer = async (actionId: string, args: unknown[]): Promise<unknown> => {
    const encodedArgs = await encodeActionArgs(args);

    const response = await fetch(actionEndpoint, {
      method: "POST",
      body: encodedArgs.data,
      headers: {
        "Content-Type":
          encodedArgs.type === "formdata" ? "application/x-www-form-urlencoded" : "text/plain",
        "x-rsc-action": actionId,
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`Action request failed: ${response.status}`);
    }

    return consumeRSC(response.body!, { callServer });
  };

  return callServer;
}

/**
 * Fetch and consume an RSC endpoint
 *
 * Automatically waits for the service worker to be controlling the page.
 *
 * @example
 * ```ts
 * const element = await fetchRSC('/rsc');
 * root.render(element);
 * ```
 */
export async function fetchRSC<T = unknown>(
  url: string,
  options?: RequestInit & ConsumeRSCOptions,
): Promise<T> {
  await ensureWorkerReady();

  const { callServer, ...fetchOptions } = options ?? {};

  const response = await fetch(url, {
    headers: {
      Accept: "text/x-component",
      ...fetchOptions?.headers,
    },
    ...fetchOptions,
  });

  if (!response.ok) {
    throw new Error(`RSC fetch failed: ${response.status}`);
  }

  return consumeRSC<T>(response.body!, { callServer });
}

/**
 * Options for calling a server action
 */
export interface CallActionOptions extends Omit<RequestInit, "method" | "body"> {
  /**
   * If true, the response will be parsed as RSC and returned
   * If false (default), only success/failure is checked
   */
  parseResponse?: boolean;
}

/**
 * Call a server action from the client
 *
 * Automatically waits for the service worker to be controlling the page.
 *
 * @example
 * ```ts
 * // Simple action call (just check success)
 * await callAction('/rsc/movies', 'updateRating', [movieId, 5]);
 *
 * // Action that returns RSC data
 * const result = await callAction('/rsc/movies', 'getDetails', [movieId], { parseResponse: true });
 * ```
 */
export async function callAction<T = void>(
  endpoint: string,
  actionId: string,
  args: unknown[],
  options?: CallActionOptions,
): Promise<T> {
  await ensureWorkerReady();

  const { parseResponse = false, ...fetchOptions } = options ?? {};
  const encodedArgs = await encodeActionArgs(args);

  const response = await fetch(endpoint, {
    method: "POST",
    body: encodedArgs.data,
    headers: {
      "Content-Type":
        encodedArgs.type === "formdata" ? "application/x-www-form-urlencoded" : "text/plain",
      "x-rsc-action": actionId,
      ...fetchOptions?.headers,
    },
    ...fetchOptions,
  });

  if (!response.ok) {
    throw new Error(`Action '${actionId}' failed: ${response.status}`);
  }

  if (parseResponse && response.body) {
    return consumeRSC<T>(response.body);
  }

  return undefined as T;
}

// Re-export types
export type { EncodedActionArgs };
