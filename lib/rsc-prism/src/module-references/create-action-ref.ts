/**
 * Runtime helper for creating action refs that invoke callAction when called.
 * Used by Vite plugin codegen for main-thread proxy modules.
 */
import { callAction } from "../client-only";
import { SERVER_REFERENCE_SYMBOL } from "./constants";

export function createActionRef(id: string) {
  const ref = function (...args: unknown[]) {
    return callAction(ref, args);
  };
  (ref as { $$typeof: symbol; $$id: string; $$bound: null }).$$typeof = SERVER_REFERENCE_SYMBOL;
  (ref as { $$typeof: symbol; $$id: string; $$bound: null }).$$id = id;
  (ref as { $$typeof: symbol; $$id: string; $$bound: null }).$$bound = null;
  return ref;
}
