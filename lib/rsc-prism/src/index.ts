// Root entrypoint intentionally avoids broad runtime re-exports to keep bundle
// surfaces small. Import runtime APIs from explicit subpaths (e.g. /client-only,
// /transport, /runtime/*) when needed.

export type {
  ClientManifest,
  RscModuleReferenceId,
  RscActionId,
  EncodedActionArgs,
  ServerModule,
  RSCRenderOptions,
  ServerActionEntry,
  RSCContext,
} from "./types";
export type { CreateRSCConfig, CreateRSCResult, CreateWorkerRowHandlerOptions } from "./server";

export {
  clientRef,
  createClientRefs,
  createClientModule,
  type ClientReference,
} from "./module-references/client-reference";
