/**
 * Stub action ref for worker component extraction; throws when called.
 * Separate from create-action-ref to avoid pulling client-only into worker context.
 */
import { SERVER_REFERENCE_SYMBOL } from "./constants";

export function createActionRefStub(id: string) {
  const ref = function () {
    throw new Error(
      "[rsc-prism] Worker action references cannot execute within worker component extraction directly.",
    );
  };
  (ref as { $$typeof: symbol; $$id: string; $$bound: null }).$$typeof = SERVER_REFERENCE_SYMBOL;
  (ref as { $$typeof: symbol; $$id: string; $$bound: null }).$$id = id;
  (ref as { $$typeof: symbol; $$id: string; $$bound: null }).$$bound = null;
  return ref;
}
