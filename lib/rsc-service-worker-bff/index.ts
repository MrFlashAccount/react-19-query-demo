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

// HTTP method helpers
export { http } from "./http";

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
  fetchRSC,
  consumeRSC,
  createCallServer,
  // Polyfill
  polyfillReady,
} from "./rsc";
