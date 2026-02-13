// Root entrypoint intentionally exports client-safe APIs only to avoid eagerly loading
// server-side React runtime code in browser bundles. Use explicit subpaths for server APIs.
export * from "./client-only";

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

export type { CreateRSCConfig, CreateRSCResult } from "./server";
export type { CreateRSCHandlerOptions } from "./response";

export {
  clientRef,
  createClientRefs,
  createClientModule,
  type ClientReference,
} from "./client-reference";
