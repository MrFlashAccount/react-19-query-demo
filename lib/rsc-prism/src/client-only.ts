/**
 * Client-only RSC utilities for main thread
 *
 * This module can be safely imported on the main thread without pulling in
 * react-server-dom-webpack/server which requires the react-server condition.
 *
 * Usage:
 * ```ts
 * import { registerClientModule, fetchRSC, callAction } from '@lib/rsc-service-worker-bff/rsc/client-only';
 * ```
 */

// Client utilities (fetch/consume RSC)
export {
  consumeRSC,
  consumeRSCResponse,
  encodeActionArgs,
  createCallServer,
  fetchRSC,
  callAction,
  type ConsumeRSCOptions,
  type FetchRSCOptions,
  type WorkerComponentReference,
  type CallActionOptions,
  type RSCRequestOptions,
} from "./client";

// Module registry
export {
  registerClientModule,
  registerClientModules,
  hasModule,
  getModule,
  buildClientManifest,
  buildClientManifestFromModule,
  mergeManifests,
} from "./runtime/module-registry";

// Polyfill
export { polyfillReady, isPolyfillRequired } from "./polyfill";

// Webpack shim (required for react-server-dom-webpack/client)
export { moduleCache } from "./runtime/webpack-shim";

// Transport
export {
  createFetchTransport,
  createFunctionTransport,
  createWorkerTransport,
  createWorkerTransportMessageHandler,
  type RSCTransport,
  type FunctionTransportHandler,
  type FunctionTransportRequest,
  type WorkerMessageEndpoint,
  type WorkerTransportOptions,
  type WorkerTransportRequestMessage,
  type WorkerTransportResponseMessage,
  type WorkerTransportResponseHeadMessage,
  type WorkerTransportResponseNextMessage,
  type WorkerTransportResponseDoneMessage,
  type WorkerTransportResponseErrorMessage,
} from "./transport";

// Types (no runtime, just TS)
export type { ClientManifest, ClientManifestEntry } from "./types";
