/**
 * RSC client helpers.
 */

import {
  DEFAULT_WORKER_RUNTIME_GLOBAL_KEY,
  WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY,
} from "./runtime-globals";
import { defaultFlightProtocolAdapter } from "./actions/adapter";
import { resolveClientManifestOrThrow } from "./runtime/client-manifest";
import { WORKER_REFERENCE_SYMBOL, SERVER_REFERENCE_SYMBOL } from "./module-references/constants";
import { type ComponentReference, type EncodedActionArgs } from "./types";
import type { RSCTransport } from "./transport";
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
    typeof (value as Partial<RSCTransport>).sendActionDirect === "function"
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
export interface RSCTransportOptions {
  transport?: RSCTransport | null | undefined;
}

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

export interface FetchRSCOptions extends ConsumeRSCOptions, RSCTransportOptions {
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
  return candidate.$$typeof === WORKER_REFERENCE_SYMBOL && typeof candidate.$$id === "string";
}

function isWorkerActionReference(value: unknown): value is WorkerActionReference {
  if (typeof value !== "function" && (typeof value !== "object" || value == null)) {
    return false;
  }
  const candidate = value as Partial<WorkerActionReference>;
  return candidate.$$typeof === SERVER_REFERENCE_SYMBOL && typeof candidate.$$id === "string";
}

/**
 * Encode action arguments for sending to the server
 *
 * @example
 * ```ts
 * const encoded = await encodeActionArgs([count, { increment: true }]);
 * const result = await transport.sendActionDirect({ actionId, body: encoded.data, ... });
 * ```
 */
export async function encodeActionArgs(args: unknown[]): Promise<EncodedActionArgs> {
  return defaultFlightProtocolAdapter.encodeActionArgs(args);
}

/**
 * Create a callServer function for use with RSC row transport
 *
 * @example
 * ```ts
 * const callServer = createCallServer();
 * const element = await fetchRSC(componentRef, { callServer });
 * ```
 */
export function createCallServer(
  options?: RSCTransportOptions,
): (actionId: string, args: unknown[]) => Promise<unknown> {
  const transport = resolveTransport(options?.transport);
  if (transport.sendActionDirect == null) {
    throw new Error(
      "[rsc-prism] Transport must support sendActionDirect. Use worker row transport.",
    );
  }
  const callServer = async (actionId: string, args: unknown[]): Promise<unknown> => {
    const encodedArgs = await encodeActionArgs(args);
    const manifest = resolveClientManifestOrThrow();
    return transport.sendActionDirect!(
      {
        actionId,
        body: encodedArgs.data as string | FormData,
      },
      { manifest, callServer },
    );
  };
  return callServer;
}

/**
 * Fetch RSC via worker postMessage transport.
 * Requires a "use worker" component reference.
 *
 * @example
 * ```ts
 * const element = await fetchRSC(TodoViewRef, { props: { filter: "all" } });
 * root.render(element);
 * ```
 */
export async function fetchRSC<Props, Target extends ComponentReference<Props>>(
  target: Target,
  options?: FetchRSCOptionsForTarget<Props>,
): Promise<Awaited<ReturnType<Target>>> {
  const transport = resolveTransport(options?.transport);
  const { callServer, props, transport: _transport } = options ?? {};
  const resolvedCallServer = callServer ?? createCallServer({ transport });
  const workerComponent = target;

  if (!isWorkerComponentReference(workerComponent)) {
    throw new Error(
      '[rsc-prism] fetchRSC(component, ...) expects a "use worker" component reference generated by @lib/rsc-prism/vite in main mode.',
    );
  }

  if (transport.fetchRSCDirect == null) {
    throw new Error("[rsc-prism] Transport must support fetchRSCDirect. Use worker row transport.");
  }
  const manifest = resolveClientManifestOrThrow();
  return transport.fetchRSCDirect<Awaited<ReturnType<Target>>>(
    { componentId: workerComponent.$$id, componentProps: props },
    { manifest, callServer: resolvedCallServer },
  );
}

/**
 * Options for calling a server action
 */
export interface CallActionOptions {
  transport?: RSCTransport;
}

/**
 * Call a server action via worker postMessage transport.
 *
 * @example
 * ```ts
 * await callAction(updateRatingRef, [movieId, 5]);
 * const result = await callAction(getDetailsRef, [movieId]);
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
  const encodedArgs = await encodeActionArgs(args);

  const manifest = resolveClientManifestOrThrow();
  return transport.sendActionDirect<T>(
    {
      actionId,
      body: encodedArgs.data as string | FormData,
    },
    { manifest },
  );
}

// Re-export types
export type { EncodedActionArgs };
