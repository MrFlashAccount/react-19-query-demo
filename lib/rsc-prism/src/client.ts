/**
 * RSC client helpers.
 */

import "./runtime/webpack-shim";
import type { EncodedActionArgs } from "./types";
import { createFetchTransport, type RSCTransport } from "./transport";
import * as ReactServerDomWebpackClient from "react-server-dom-webpack/client.browser";

const { createFromReadableStream, encodeReply } = ReactServerDomWebpackClient as {
  createFromReadableStream: <T>(
    stream: ReadableStream<Uint8Array>,
    options?: { callServer?: (actionId: string, args: unknown[]) => Promise<unknown> },
  ) => Promise<T>;
  encodeReply: (value: unknown) => Promise<FormData | string>;
};

const defaultFetchTransport = createFetchTransport();

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
  transport?: RSCTransport | null | undefined;
}

const WORKER_COMPONENT_REFERENCE = Symbol.for("rsc.worker.reference");
const SERVER_ACTION_REFERENCE = Symbol.for("react.server.reference");
const DEFAULT_ACTION_ENDPOINT = "/rsc/action";

export interface WorkerComponentReference<Props = unknown, Result = unknown> {
  $$typeof: symbol;
  $$id: string;
  $$moduleId: string;
  $$name: string;
  /**
   * Phantom slot used only for type inference in fetchRSC overloads.
   */
  readonly __propsType__?: Props;
  /**
   * Phantom slot used only for type inference in fetchRSC overloads.
   */
  readonly __resultType__?: Result;
}

export interface WorkerActionReference<Args extends unknown[] = unknown[], Result = unknown> {
  $$typeof: symbol;
  $$id: string;
  $$bound?: null;
  readonly __argsType__?: Args;
  readonly __resultType__?: Result;
}

export interface FetchRSCOptions extends ConsumeRSCOptions, RSCRequestOptions {
  props?: unknown;
}

type FetchRSCOptionsForTarget<Props> = Omit<FetchRSCOptions, "props"> & {
  props?: Props;
};

function isWorkerComponentReference(value: unknown): value is WorkerComponentReference {
  if (typeof value !== "function" && (typeof value !== "object" || value == null)) {
    return false;
  }

  const candidate = value as Partial<WorkerComponentReference>;
  return candidate.$$typeof === WORKER_COMPONENT_REFERENCE && typeof candidate.$$id === "string";
}

function isWorkerActionReference(value: unknown): value is WorkerActionReference {
  if (typeof value !== "function" && (typeof value !== "object" || value == null)) {
    return false;
  }
  const candidate = value as Partial<WorkerActionReference>;
  return candidate.$$typeof === SERVER_ACTION_REFERENCE && typeof candidate.$$id === "string";
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
      data: encoded,
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
  const transport = options?.transport ?? defaultFetchTransport;
  const callServer = async (actionId: string, args: unknown[]): Promise<unknown> => {
    const encodedArgs = await encodeActionArgs(args);
    const contentType = encodedArgs.type === "formdata" ? undefined : "text/plain";

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
export async function fetchRSC<
  Props,
  Target extends (props: Props) => React.JSX.Element | null | React.JSX.Element[],
>(target: Target, options?: FetchRSCOptionsForTarget<Props>): Promise<Awaited<ReturnType<Target>>>;
export async function fetchRSC(
  target: ((props: unknown) => unknown) | string,
  options?: FetchRSCOptions,
): Promise<unknown> {
  const transport = options?.transport ?? defaultFetchTransport;
  const { callServer, props, transport: _transport } = options ?? {};
  const workerComponent = typeof target === "string" ? null : target;
  const url = "/rsc/view";

  if (workerComponent != null && !isWorkerComponentReference(workerComponent)) {
    throw new Error(
      '[rsc-prism] fetchRSC(component, ...) expects a "use worker" component reference generated by @lib/rsc-prism/vite in main mode.',
    );
  }

  const response =
    transport.fetchRSC != null
      ? await transport.fetchRSC({
          url,
          componentId: workerComponent?.$$id,
          componentProps: props,
        })
      : await fetch(url, { headers: { Accept: "text/x-component" } });

  if (!response.ok) {
    throw new Error(`RSC fetch failed: ${response.status}`);
  }

  return consumeRSC(response.body!, { callServer });
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
  endpoint?: string;
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
export async function callAction<TAction extends (...args: any[]) => any>(
  action: TAction,
  args: Parameters<TAction>,
  options?: CallActionOptions,
): Promise<Awaited<ReturnType<TAction>>>;
export async function callAction<T = void>(
  action: WorkerActionReference,
  args: unknown[],
  options?: CallActionOptions,
): Promise<T>;
export async function callAction<T = void>(
  action: WorkerActionReference | ((...args: any[]) => any),
  args: unknown[],
  options?: CallActionOptions,
): Promise<T> {
  if (!isWorkerActionReference(action)) {
    throw new Error(
      '[rsc-prism] callAction(actionRef, args, ...) expects a "use worker" action reference generated by @lib/rsc-prism/vite in main mode.',
    );
  }

  const actionId = action.$$id;
  const transport = options?.transport ?? defaultFetchTransport;
  const endpoint = options?.endpoint ?? DEFAULT_ACTION_ENDPOINT;
  const {
    parseResponse = false,
    transport: _transport,
    endpoint: _endpoint,
    ...fetchOptions
  } = options ?? {};
  const encodedArgs = await encodeActionArgs(args);
  const contentType = encodedArgs.type === "formdata" ? undefined : "text/plain";

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
