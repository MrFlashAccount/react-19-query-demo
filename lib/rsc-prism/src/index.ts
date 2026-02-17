// Root entrypoint intentionally avoids broad runtime re-exports to keep bundle
// surfaces small. Import runtime APIs from explicit subpaths (e.g. /client-only,
// /transport, /runtime/*) when needed.

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
