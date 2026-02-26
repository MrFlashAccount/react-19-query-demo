/**
 * Runtime helper for creating action refs that invoke callAction when called.
 * Used by Vite plugin codegen for main-thread proxy modules.
 */
import { callAction } from "../client-only";
import { SERVER_REFERENCE_SYMBOL } from "./constants";

export function createActionRef(id: string) {
  const ref = function (...args: unknown[]): Promise<unknown> {
    return callAction(ref, args);
  };
  const tagged = ref as unknown as { $$typeof: symbol; $$id: string; $$bound: null };
  tagged.$$typeof = SERVER_REFERENCE_SYMBOL;
  tagged.$$id = id;
  tagged.$$bound = null;
  return ref;
}
