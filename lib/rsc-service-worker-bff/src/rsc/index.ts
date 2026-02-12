/**
 * RSC Module for Service Worker BFF
 *
 * React Server Components support for service workers.
 *
 * ## Quick Start
 *
 * ### Service Worker Setup
 *
 * ```ts
 * // sw.ts
 * import { setupWorker, http, json } from '@lib/rsc-service-worker-bff';
 * import {
 *   createRSCHandler,
 *   rscGet,
 *   rscPost,
 * } from '@lib/rsc-service-worker-bff/rsc';
 * import React from 'react';
 *
 * // Define your server component
 * function App() {
 *   return <div>Hello from RSC!</div>;
 * }
 *
 * // Create handler with manifest and actions
 * const rsc = createRSCHandler({
 *   manifest: {
 *     'client': { id: 'client', chunks: [], name: '*' },
 *   },
 *   actions: {
 *     async increment(count: number) { return count + 1; },
 *   },
 * });
 *
 * setupWorker([
 *   rscGet('/rsc', rsc, () => <App />),
 *   rscPost('/rsc', rsc),
 * ]);
 * ```
 *
 * ### Client Setup
 *
 * ```ts
 * // main.ts
 * import './rsc/webpack-shim';
 * import { registerClientModule, fetchRSC, createCallServer } from '@lib/rsc-service-worker-bff/rsc';
 * import * as ClientComponents from './components';
 *
 * // Register client components
 * registerClientModule('client', ClientComponents);
 *
 * // Fetch and render RSC
 * const callServer = createCallServer('/rsc');
 * const element = await fetchRSC('/rsc', { callServer });
 * root.render(element);
 * ```
 */

// ============================================
// IMPORTANT: Import order matters!
// Always import webpack-shim first in your entry files
// ============================================

// Webpack shim - must be imported first
export { moduleCache } from "./webpack-shim";

// Polyfill
export { polyfillReady, isPolyfillRequired } from "./polyfill";

// Types
export type {
  ClientManifest,
  ClientManifestEntry,
  EncodedActionArgs,
  ServerModule,
  RSCRenderOptions,
  ServerActionEntry,
  RSCContext,
  RSCHandlerOptions,
  RSCResponseOptions,
} from "./types";

// Server (for service worker)
export {
  createRSCContext,
  registerAction,
  registerActions,
  createClientProxy,
  renderRSC,
  decodeActionArgs,
  handleAction,
  getActionIdFromRequest,
  isActionRequest,
} from "./server";

// Client (for main thread)
export {
  ensureWorkerReady,
  createServiceWorkerTransport,
  consumeRSC,
  consumeRSCResponse,
  encodeActionArgs,
  createCallServer,
  fetchRSC,
  callAction,
  type ConsumeRSCOptions,
  type CallActionOptions,
  type RSCRequestOptions,
} from "./client";

// Core transport
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
} from "@lib/rsc-prism/transport";

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

// Response helpers
export {
  RSC_CONTENT_TYPE,
  rsc,
  rscWithContext,
  rscAction,
  rscError,
  createRSCHandler,
  type CreateRSCHandlerOptions,
} from "./response";

// HTTP route helpers
export {
  rscGet,
  rscPost,
  rscRoutes,
  createRSCRoutes,
  type RSCRouteContext,
  type RSCRenderHandler,
} from "./http";

// Flight serializer (custom RSC serialization for SW environment)
export {
  serializeToFlightStream,
  createFlightResponse,
  createServerAction,
  getServerAction,
  executeServerAction,
} from "./flight-serializer";
