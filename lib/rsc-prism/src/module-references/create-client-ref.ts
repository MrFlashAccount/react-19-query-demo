/**
 * Lightweight runtime helper for creating client refs by ID.
 * Used by Vite plugin codegen. refId is required for O(1) wire resolution.
 */
import { CLIENT_REFERENCE_SYMBOL } from "./constants";

export type ClientRefShape = { $$typeof: symbol; $$id: string; $$refId: number };

export function createClientRef(id: string, refId: number): ClientRefShape {
  return {
    $$typeof: CLIENT_REFERENCE_SYMBOL,
    $$id: id,
    $$refId: refId,
  } as ClientRefShape;
}
