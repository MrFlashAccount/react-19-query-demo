/**
 * Module references: client refs, server refs, annotate helpers.
 * Entry for wire, server, decode-reply, vite codegen. Public API via ./client-reference.
 */
export {
  clientRef,
  createClientRefs,
  createClientModule,
  type ClientReference,
} from "./client-reference";
export { createClientRef } from "./create-client-ref";
export { createWorkerRef } from "./create-worker-ref";
export { createActionRef } from "./create-action-ref";
export { createActionRefStub } from "./create-action-ref-stub";
export {
  annotateClientReference,
  annotateServerReference,
  createClientModuleProxy,
} from "./annotate";
export {
  CLIENT_REFERENCE_SYMBOL,
  SERVER_REFERENCE_SYMBOL,
  WORKER_REFERENCE_SYMBOL,
} from "./constants";
