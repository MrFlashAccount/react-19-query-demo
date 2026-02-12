// Runtime shim (opt-in side effect import)
export { moduleCache } from "./runtime/webpack-shim";

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

// Server
export {
  createRSC,
  createRSCContext,
  registerAction,
  registerActions,
  createClientProxy,
  renderRSC,
  decodeActionArgs,
  handleAction,
  getActionIdFromRequest,
  isActionRequest,
  type CreateRSCConfig,
  type CreateRSCResult,
} from "./server";

// Client
export {
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
} from "./transport";

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

// Flight serializer
export {
  serializeToFlightStream,
  createFlightResponse,
  createServerAction,
  getServerAction,
  executeServerAction,
} from "./flight-serializer";

// Client reference utilities
export {
  clientRef,
  createClientRefs,
  createClientModule,
  type ClientReference,
} from "./client-reference";
