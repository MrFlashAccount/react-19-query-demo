// Types
export type {
  HttpMethod,
  RouteParams,
  RequestContext,
  RequestHandler,
  RouteDefinition,
  ServiceWorkerOptions,
  ServiceWorker,
} from "./types";

// HTTP method helpers (includes rsc, action, rscRoutes)
export { http, type RSCRouteOptions } from "./http";

// Response helpers
export { json, text, html, redirect, noContent, error, passthrough } from "./response";

// Worker setup (for service worker file)
export { setupWorker } from "./worker";

// Worker registration (for main thread)
export { createWorker } from "./worker";

// RSC support - re-export commonly used items
// For full RSC API, use: import { ... } from '@lib/rsc-service-worker-bff/rsc'
export {
  // Handler creation
  createRSCHandler,
  // Route helpers
  rscGet,
  rscPost,
  rscRoutes,
  createRSCRoutes,
  // Response helpers
  rsc,
  rscAction,
  rscError,
  // Module registry (for client)
  registerClientModule,
  buildClientManifest,
  // Client helpers
  ensureWorkerReady,
  createServiceWorkerTransport,
  fetchRSC,
  consumeRSC,
  createCallServer,
  callAction,
  type CallActionOptions,
  // Polyfill
  polyfillReady,
} from "./rsc";

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

// Client reference utilities (manual approach - for service worker)
export {
  clientRef,
  createClientRefs,
  createClientModule,
  type ClientReference,
} from "./rsc/client-reference";

// Official RSC server utilities (recommended - uses react-server-dom-webpack)
export {
  // All-in-one setup
  createRSC,
  type CreateRSCConfig,
  type CreateRSCResult,
  // Individual utilities
  createRSCContext,
  createClientProxy,
  registerAction,
  registerActions,
  renderRSC,
  handleAction,
  decodeActionArgs,
  isActionRequest,
  getActionIdFromRequest,
  type RSCContext,
} from "./rsc/server";

export {
  createFlightResponse,
  serializeToFlightPayload,
  serializeToFlightStream,
  createServerAction,
  executeServerAction,
  getServerAction,
} from "./rsc/flight-serializer";
