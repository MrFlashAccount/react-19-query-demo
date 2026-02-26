/**
 * Reference symbols used across RSC wire format, client refs, and server refs.
 * Single source of truth; must match React's well-known symbols for resolution.
 * Imported by wire/constants, annotate, create-client-ref, client-reference, client, and vite codegen.
 */
export const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
export const SERVER_REFERENCE_SYMBOL = Symbol.for("react.server.reference");
export const WORKER_REFERENCE_SYMBOL = Symbol.for("rsc.worker.reference");

/** Symbol keys for codegen (vite plugin); use Symbol.for(key) at runtime. */
export const REFERENCE_SYMBOL_KEYS = {
  client: "react.client.reference",
  server: "react.server.reference",
  worker: "rsc.worker.reference",
} as const;
