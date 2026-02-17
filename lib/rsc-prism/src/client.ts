/**
 * RSC client helpers.
 */

import {
  DEFAULT_WORKER_RUNTIME_GLOBAL_KEY,
  WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY,
} from "./runtime-globals";
import { defaultFlightProtocolAdapter } from "./flight-runtime/adapter";
import { resolveClientManifestOrThrow } from "./runtime/client-manifest";
import type { ComponentReference, EncodedActionArgs } from "./types";
import { createFetchTransport, type RSCTransport } from "./transport";

const defaultFetchTransport = createFetchTransport();
const MISSING_TRANSPORT_ERROR_MESSAGE =
  '[rsc-prism] Missing RSC transport. Call bootstrapWorkerRuntime() from "@lib/rsc-prism/client-only" first, or pass options.transport explicitly.';

export interface BootstrappedWorkerRuntime {
  worker: Worker;
  transport: RSCTransport;
  dispose: () => void;
}

type WorkerRuntimeBootstrap = () => Promise<BootstrappedWorkerRuntime>;

const wrappedBootstrappedRuntimes = new WeakSet<BootstrappedWorkerRuntime>();

function getRscPrismGlobalState(): typeof globalThis & Record<string, unknown> {
  return globalThis as typeof globalThis & Record<string, unknown>;
}

function getWorkerRuntimeBootstrap(): WorkerRuntimeBootstrap {
  const bootstrap = getRscPrismGlobalState()[WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY];

  if (typeof bootstrap === "function") {
    return bootstrap as WorkerRuntimeBootstrap;
  }

  throw new Error(
    "[rsc-prism] Worker runtime bootstrap is unavailable. Ensure rscPrism({ workerRuntime: { enabled: true } }) is configured and the plugin-generated bootstrap runtime has loaded.",
  );
}

function isRSCTransport(value: unknown): value is RSCTransport {
  return (
    typeof value === "object" &&
    value != null &&
    typeof (value as Partial<RSCTransport>).sendAction === "function"
  );
}

function isBootstrappedWorkerRuntime(value: unknown): value is BootstrappedWorkerRuntime {
  return (
    typeof value === "object" &&
    value != null &&
    typeof (value as Partial<BootstrappedWorkerRuntime>).dispose === "function" &&
    isRSCTransport((value as Partial<BootstrappedWorkerRuntime>).transport)
  );
}

function getDefaultWorkerRuntime(): BootstrappedWorkerRuntime | null {
  const runtime = getRscPrismGlobalState()[DEFAULT_WORKER_RUNTIME_GLOBAL_KEY];
  return isBootstrappedWorkerRuntime(runtime) ? runtime : null;
}

function setDefaultWorkerRuntime(runtime: BootstrappedWorkerRuntime): void {
  const globalState = getRscPrismGlobalState();
  globalState[DEFAULT_WORKER_RUNTIME_GLOBAL_KEY] = runtime;
}

function clearDefaultWorkerRuntime(runtime: BootstrappedWorkerRuntime): void {
  const globalState = getRscPrismGlobalState();
  if (globalState[DEFAULT_WORKER_RUNTIME_GLOBAL_KEY] !== runtime) {
    return;
  }
  delete globalState[DEFAULT_WORKER_RUNTIME_GLOBAL_KEY];
}

function registerDefaultWorkerRuntime(
  runtime: BootstrappedWorkerRuntime,
): BootstrappedWorkerRuntime {
  setDefaultWorkerRuntime(runtime);

  if (!wrappedBootstrappedRuntimes.has(runtime)) {
    const originalDispose = runtime.dispose.bind(runtime);
    runtime.dispose = () => {
      originalDispose();
      clearDefaultWorkerRuntime(runtime);
    };
    wrappedBootstrappedRuntimes.add(runtime);
  }

  return runtime;
}

function resolveTransport(transport: RSCTransport | null | undefined): RSCTransport {
  if (transport != null) {
    return transport;
  }

  const defaultWorkerRuntime = getDefaultWorkerRuntime();
  if (defaultWorkerRuntime != null) {
    return defaultWorkerRuntime.transport;
  }

  throw new Error(MISSING_TRANSPORT_ERROR_MESSAGE);
}

export async function bootstrapWorkerRuntime(): Promise<BootstrappedWorkerRuntime> {
  const runtime = await getWorkerRuntimeBootstrap()();
  return registerDefaultWorkerRuntime(runtime);
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
  const manifest = resolveClientManifestOrThrow();
  return await defaultFlightProtocolAdapter.consumeStream<T>(stream, manifest, options?.callServer);
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

async function readActionErrorMessage(response: Response): Promise<string | null> {
  if (response.body == null) {
    return null;
  }

  try {
    const manifest = resolveClientManifestOrThrow();
    const parsed = await defaultFlightProtocolAdapter.consumeStream<unknown>(response.body, manifest);
    if (typeof parsed === "string" && parsed.length > 0) {
      return parsed;
    }
    if (typeof parsed === "object" && parsed != null) {
      const tagged = parsed as {
        __rscPrismError?: unknown;
        message?: unknown;
        error?: unknown;
      };
      if (tagged.__rscPrismError === true && typeof tagged.message === "string") {
        return tagged.message;
      }
      if (typeof tagged.error === "string") {
        return tagged.error;
      }
    }
  } catch {
    // Ignore parsing errors; caller will fallback to HTTP status.
  }

  return null;
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
  return defaultFlightProtocolAdapter.encodeActionArgs(args);
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
      const message = await readActionErrorMessage(response);
      throw new Error(message ?? `Action request failed: ${response.status}`);
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
export async function fetchRSC<Props, Target extends ComponentReference<Props>>(
  target: Target,
  options?: FetchRSCOptionsForTarget<Props>,
): Promise<Awaited<ReturnType<Target>>>;
export async function fetchRSC(
  target: ((props: unknown) => unknown) | string,
  options?: FetchRSCOptions,
): Promise<unknown> {
  const transport = resolveTransport(options?.transport);
  const { callServer, props, transport: _transport } = options ?? {};
  const workerComponent = typeof target === "string" ? null : target;
  const url = "/rsc/view";

  if (workerComponent != null && !isWorkerComponentReference(workerComponent)) {
    throw new Error(
      '[rsc-prism] fetchRSC(component, ...) expects a "use worker" component reference generated by @lib/rsc-prism/vite in main mode.',
    );
  }

  if (transport.fetchRSC == null) {
    throw new Error("[rsc-prism] Active transport does not support fetchRSC().");
  }

  const response = await transport.fetchRSC({
    url,
    componentId: workerComponent?.$$id,
    componentProps: props,
  });

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
  options: CallActionOptions = {},
): Promise<T> {
  if (!isWorkerActionReference(action)) {
    throw new Error(
      '[rsc-prism] callAction(actionRef, args, ...) expects a "use worker" action reference generated by @lib/rsc-prism/vite in main mode.',
    );
  }

  const actionId = action.$$id;
  const transport = resolveTransport(options?.transport);
  const endpoint = DEFAULT_ACTION_ENDPOINT;
  const { parseResponse = false } = options;
  const encodedArgs = await encodeActionArgs(args);
  const contentType = encodedArgs.type === "formdata" ? undefined : "text/plain";

  const response = await transport.sendAction({
    endpoint,
    actionId,
    body: encodedArgs.data,
    contentType,
  });

  if (!response.ok) {
    const message = await readActionErrorMessage(response);
    throw new Error(message ?? `Action '${actionId}' failed: ${response.status}`);
  }

  if (parseResponse && response.body) {
    return consumeRSC<T>(response.body);
  }

  return response.body as T;
}

// Re-export types
export type { EncodedActionArgs };
