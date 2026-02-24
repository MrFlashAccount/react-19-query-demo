/**
 * RSC client helpers.
 */

import type { ISpan } from "@lib/tracing";
import {
  DEFAULT_WORKER_RUNTIME_GLOBAL_KEY,
  WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY,
} from "./runtime-globals";
import { defaultFlightProtocolAdapter } from "./flight-runtime/adapter";
import { resolveClientManifestOrThrow } from "./runtime/client-manifest";
import {
  createTraceRequestId,
  finishTraceSpanError,
  finishTraceSpanSuccess,
  resolveActionName,
  resolveComponentName,
  startTraceSpan,
  summarizeArgs,
} from "./tracing";
import type { ComponentReference, EncodedActionArgs } from "./types";
import type { RSCTraceContext } from "./tracing";
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
  globalState[DEFAULT_WORKER_RUNTIME_GLOBAL_KEY] = undefined;
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

export async function bootstrapWorkerRuntime(options?: {
  parentSpan?: ISpan;
}): Promise<BootstrappedWorkerRuntime> {
  const requestId = createTraceRequestId("bootstrap");
  const span = startTraceSpan(
    "rsc.client.bootstrapWorkerRuntime",
    { requestId, source: "client" },
    options?.parentSpan,
  );
  const awaitSpan = startTraceSpan(
    "rsc.client.bootstrap.awaitReady",
    { requestId, source: "client" },
    span,
    "secondary",
  );
  const createSpan = startTraceSpan(
    "rsc.transport.worker.create",
    { requestId, source: "client" },
    span,
    "secondary",
  );

  try {
    const runtime = await getWorkerRuntimeBootstrap()();
    finishTraceSpanSuccess(createSpan);
    finishTraceSpanSuccess(awaitSpan);
    finishTraceSpanSuccess(span);
    return registerDefaultWorkerRuntime(runtime);
  } catch (error) {
    finishTraceSpanError(createSpan, error);
    finishTraceSpanError(awaitSpan, error);
    finishTraceSpanError(span, error);
    throw error;
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
  parentSpan?: ISpan;
  traceContext?: RSCTraceContext;
}

/**
 * Transport-aware request options.
 */
export interface RSCRequestOptions {
  transport?: RSCTransport | null | undefined;
  parentSpan?: ISpan;
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
  const traceContext = options?.traceContext;
  const span = startTraceSpan(
    "rsc.flight.consumeStream",
    {
      requestId: traceContext?.requestId,
      actionId: traceContext?.actionId,
      source: "client",
    },
    options?.parentSpan ?? traceContext?.parentSpan,
    "secondary",
  );
  try {
    const value = await defaultFlightProtocolAdapter.consumeStream<T>(stream, manifest, {
      callServer: options?.callServer,
      traceContext,
    });
    finishTraceSpanSuccess(span);
    return value;
  } catch (error) {
    finishTraceSpanError(span, error);
    throw error;
  }
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
    const parsed = await defaultFlightProtocolAdapter.consumeStream<unknown>(
      response.body,
      manifest,
    );
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
  const { transport: _transport, parentSpan, ...requestInit } = options ?? {};
  const callServer = async (actionId: string, args: unknown[]): Promise<unknown> => {
    const requestId = createTraceRequestId("callserver");
    const actionName = resolveActionName(actionId);
    const callSpan = startTraceSpan(
      "rsc.client.callServer",
      {
        requestId,
        actionId,
        actionName,
        endpoint: actionEndpoint,
        source: "client",
        ...summarizeArgs(args),
      },
      parentSpan,
    );
    const encodeSpan = startTraceSpan(
      "rsc.action.encodeArgs",
      { requestId, actionId, actionName, source: "client" },
      callSpan,
      "secondary",
    );
    const encodedArgs = await encodeActionArgs(args);
    finishTraceSpanSuccess(encodeSpan, {
      encodedType: encodedArgs.type,
    });
    const contentType = encodedArgs.type === "formdata" ? undefined : "text/plain";
    const traceContext: RSCTraceContext = {
      requestId,
      actionId,
      parentSpan: callSpan,
      source: "client",
    };

    if (transport.sendActionDirect != null) {
      const manifest = resolveClientManifestOrThrow();
      try {
        const result = await transport.sendActionDirect(
          {
            endpoint: actionEndpoint,
            actionId,
            body: encodedArgs.data,
            contentType,
            headers: requestInit.headers,
            requestInit,
            trace: traceContext,
          },
          { manifest, callServer, traceContext },
        );
        finishTraceSpanSuccess(callSpan);
        return result;
      } catch (error) {
        finishTraceSpanError(callSpan, error);
        throw error;
      }
    }

    let response: Response;
    try {
      response = await transport.sendAction({
        endpoint: actionEndpoint,
        actionId,
        body: encodedArgs.data,
        contentType,
        headers: requestInit.headers,
        requestInit,
        trace: traceContext,
      });
    } catch (error) {
      finishTraceSpanError(callSpan, error);
      throw error;
    }

    if (!response.ok) {
      const message = await readActionErrorMessage(response);
      finishTraceSpanError(callSpan, new Error(message ?? `Action request failed: ${response.status}`));
      throw new Error(message ?? `Action request failed: ${response.status}`);
    }

    try {
      const result = await consumeRSC(response.body!, {
        callServer,
        parentSpan: callSpan,
        traceContext,
      });
      finishTraceSpanSuccess(callSpan);
      return result;
    } catch (error) {
      finishTraceSpanError(callSpan, error);
      throw error;
    }
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
export async function fetchRSC(target: string, options?: FetchRSCOptions): Promise<unknown>;
export async function fetchRSC(
  target: ((props: unknown) => unknown) | string,
  options?: FetchRSCOptions,
): Promise<unknown> {
  const workerComponentCandidate = typeof target === "string" ? null : target;
  const workerComponentMeta = workerComponentCandidate as Partial<WorkerComponentReference> | null;
  const componentId =
    workerComponentMeta != null && typeof workerComponentMeta.$$id === "string"
      ? workerComponentMeta.$$id
      : undefined;
  const componentName =
    workerComponentMeta != null && typeof workerComponentMeta.$$name === "string"
      ? workerComponentMeta.$$name
      : resolveComponentName(componentId);
  const requestId = createTraceRequestId("fetch");
  const rootSpan = startTraceSpan(
    "rsc.client.fetchRSC",
    {
      requestId,
      componentId,
      componentName,
      source: "client",
    },
    options?.parentSpan,
  );
  const transport = resolveTransport(options?.transport);
  const { callServer, props, transport: _transport, parentSpan: _parentSpan, ...restOptions } =
    options ?? {};
  const traceContext: RSCTraceContext = {
    requestId,
    parentSpan: rootSpan,
    source: "client",
  };
  const resolvedCallServer =
    callServer ??
    createCallServer(DEFAULT_ACTION_ENDPOINT, {
      transport,
      parentSpan: rootSpan,
    });
  const workerComponent = workerComponentCandidate;
  const url = "/rsc/view";

  if (workerComponent != null && !isWorkerComponentReference(workerComponent)) {
    finishTraceSpanError(rootSpan, new Error("Invalid worker component reference"));
    throw new Error(
      '[rsc-prism] fetchRSC(component, ...) expects a "use worker" component reference generated by @lib/rsc-prism/vite in main mode.',
    );
  }

  if (transport.fetchRSCDirect != null) {
    const manifest = resolveClientManifestOrThrow();
    try {
      const value = await transport.fetchRSCDirect(
        {
          url,
          componentId: workerComponent?.$$id,
          componentProps: props,
          trace: traceContext,
        },
        { manifest, callServer: resolvedCallServer, traceContext },
      );
      finishTraceSpanSuccess(rootSpan);
      return value;
    } catch (error) {
      finishTraceSpanError(rootSpan, error);
      throw error;
    }
  }

  if (transport.fetchRSC == null) {
    finishTraceSpanError(rootSpan, new Error("Active transport does not support fetchRSC"));
    throw new Error("[rsc-prism] Active transport does not support fetchRSC().");
  }

  const response = await transport.fetchRSC({
    url,
    componentId: workerComponent?.$$id,
    componentProps: props,
    trace: traceContext,
  });

  if (!response.ok) {
    finishTraceSpanError(rootSpan, new Error(`RSC fetch failed: ${response.status}`));
    throw new Error(`RSC fetch failed: ${response.status}`);
  }

  try {
    const value = await consumeRSC(response.body!, {
      callServer: resolvedCallServer,
      parentSpan: rootSpan,
      traceContext,
      ...restOptions,
    });
    finishTraceSpanSuccess(rootSpan, {
      componentId: workerComponent?.$$id,
      componentName: workerComponent?.$$name ?? resolveComponentName(workerComponent?.$$id),
    });
    return value;
  } catch (error) {
    finishTraceSpanError(rootSpan, error);
    throw error;
  }
}

/**
 * Options for calling a server action
 */
export interface CallActionOptions extends Omit<RequestInit, "method" | "body"> {
  /**
   * If true, the response will be parsed as RSC and returned
   * If false, only success/failure is checked
   */
  parseResponse?: boolean;
  transport?: RSCTransport;
  endpoint?: string;
  parentSpan?: ISpan;
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
  const actionName = resolveActionName(actionId);
  const requestId = createTraceRequestId("action");
  const actionSpan = startTraceSpan(
    "rsc.action.call",
    {
      requestId,
      actionId,
      actionName,
      source: "client",
      parseResponse: options.parseResponse ?? true,
      ...summarizeArgs(args),
    },
    options.parentSpan,
  );
  const transport = resolveTransport(options?.transport);
  const endpoint = options.endpoint ?? DEFAULT_ACTION_ENDPOINT;
  const { parseResponse = true } = options;
  const encodeSpan = startTraceSpan(
    "rsc.action.encodeArgs",
    { requestId, actionId, actionName, source: "client" },
    actionSpan,
    "secondary",
  );
  const encodedArgs = await encodeActionArgs(args);
  finishTraceSpanSuccess(encodeSpan, {
    encodedType: encodedArgs.type,
  });
  const contentType = encodedArgs.type === "formdata" ? undefined : "text/plain";
  const traceContext: RSCTraceContext = {
    requestId,
    actionId,
    parentSpan: actionSpan,
    source: "client",
  };

  if (parseResponse && transport.sendActionDirect != null) {
    const manifest = resolveClientManifestOrThrow();
    try {
      const value = await transport.sendActionDirect<T>(
        {
          endpoint,
          actionId,
          body: encodedArgs.data,
          contentType,
          trace: traceContext,
        },
        { manifest, traceContext },
      );
      finishTraceSpanSuccess(actionSpan);
      return value;
    } catch (error) {
      finishTraceSpanError(actionSpan, error);
      throw error;
    }
  }

  const response = await transport.sendAction({
    endpoint,
    actionId,
    body: encodedArgs.data,
    contentType,
    trace: traceContext,
  });

  if (!response.ok) {
    const message = await readActionErrorMessage(response);
    finishTraceSpanError(actionSpan, new Error(message ?? `Action '${actionId}' failed: ${response.status}`));
    throw new Error(message ?? `Action '${actionId}' failed: ${response.status}`);
  }

  if (parseResponse && response.body) {
    const consumeSpan = startTraceSpan(
      "rsc.action.consumeResponse",
      {
        requestId,
        actionId,
        actionName,
        source: "client",
      },
      actionSpan,
      "secondary",
    );
    try {
      const value = await consumeRSC<T>(response.body, {
        parentSpan: actionSpan,
        traceContext,
      });
      finishTraceSpanSuccess(consumeSpan);
      finishTraceSpanSuccess(actionSpan);
      return value;
    } catch (error) {
      finishTraceSpanError(consumeSpan, error);
      finishTraceSpanError(actionSpan, error);
      throw error;
    }
  }

  finishTraceSpanSuccess(actionSpan);
  return response.body as T;
}

// Re-export types
export type { EncodedActionArgs };
