/**
 * Flight server runtime: public API.
 *
 * Re-exports from server-encode, server-render, decode-reply.
 * Keeps registerServerReference here (references bridge).
 */

import { annotateServerReference } from "./references";
import { renderToReadableStream, renderToRowEmitter } from "./server-render";
import type { FlightRowEmit } from "./server-encode";

export type { FlightRowEmit };
export { renderToReadableStream, renderToRowEmitter };

export function registerServerReference<T extends (...args: any[]) => any>(
  fn: T,
  id: string,
  _name: string | null = null,
): T {
  const annotated = annotateServerReference(fn, id);
  return annotated as T;
}
