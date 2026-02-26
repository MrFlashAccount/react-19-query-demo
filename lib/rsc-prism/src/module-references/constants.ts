/**
 * Reference symbols used across RSC wire format, client refs, and server refs.
 * Single source of truth; must match React's well-known symbols for resolution.
 * Imported by wire/constants, annotate, create-client-ref, and client-reference.
 */
export const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
export const SERVER_REFERENCE_SYMBOL = Symbol.for("react.server.reference");
