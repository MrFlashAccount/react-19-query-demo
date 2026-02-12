/**
 * RSC client helpers.
 */

import { createFromReadableStream, encodeReply } from "react-server-dom-webpack/client.browser";
import type { EncodedActionArgs } from "./types";
import { createFetchTransport, type RSCTransport } from "./transport";

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
 * Transport-aware request options.
 */
export interface RSCRequestOptions {
  transport?: RSCTransport;
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
  return await createFromReadableStream<T>(
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
  const encoded = await encodeReply(args);

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
  options?: Omit<RequestInit, "method" | "body"> & RSCRequestOptions,
): (actionId: string, args: unknown[]) => Promise<unknown> {
  const transport = options?.transport ?? createFetchTransport();
  const callServer = async (actionId: string, args: unknown[]): Promise<unknown> => {
    const encodedArgs = await encodeActionArgs(args);
    const contentType =
      encodedArgs.type === "formdata" ? "application/x-www-form-urlencoded" : "text/plain";

    const response = await transport.sendAction({
      endpoint: actionEndpoint,
      actionId,
      body: encodedArgs.data,
      contentType,
      headers: options?.headers,
      requestInit: options,
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
  options?: RequestInit & ConsumeRSCOptions & RSCRequestOptions,
): Promise<T> {
  const transport = options?.transport ?? createFetchTransport();
  const { callServer, transport: _transport, ...fetchOptions } = options ?? {};
  const response =
    transport.fetchRSC != null
      ? await transport.fetchRSC({
          url,
          headers: fetchOptions?.headers,
          requestInit: fetchOptions,
        })
      : await fetch(url, {
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
  transport?: RSCTransport;
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
  const transport = options?.transport ?? createFetchTransport();
  const { parseResponse = false, transport: _transport, ...fetchOptions } = options ?? {};
  const encodedArgs = await encodeActionArgs(args);
  const contentType =
    encodedArgs.type === "formdata" ? "application/x-www-form-urlencoded" : "text/plain";

  const response = await transport.sendAction({
    endpoint,
    actionId,
    body: encodedArgs.data,
    contentType,
    headers: fetchOptions?.headers,
    requestInit: fetchOptions,
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
