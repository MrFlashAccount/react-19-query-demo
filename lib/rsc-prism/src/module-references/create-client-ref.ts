/**
 * Lightweight runtime helper for creating client refs by ID.
 * Used by Vite plugin codegen instead of inlining Symbol + factory.
 * Keeps generated proxy modules small; single import vs repeated inline defs.
 */
import { CLIENT_REFERENCE_SYMBOL } from "./constants";

export function createClientRef(id: string): { $$typeof: symbol; $$id: string } {
  return { $$typeof: CLIENT_REFERENCE_SYMBOL, $$id: id };
}
