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
  ensureWorkerReady,
  consumeRSC,
  consumeRSCResponse,
  encodeActionArgs,
  createCallServer,
  fetchRSC,
  callAction,
  type ConsumeRSCOptions,
  type CallActionOptions,
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
} from "./module-registry";

// Polyfill
export { polyfillReady, isPolyfillRequired } from "./polyfill";

// Webpack shim (required for react-server-dom-webpack/client)
export { moduleCache } from "./webpack-shim";

// Types (no runtime, just TS)
export type { ClientManifest, ClientManifestEntry } from "./types";
