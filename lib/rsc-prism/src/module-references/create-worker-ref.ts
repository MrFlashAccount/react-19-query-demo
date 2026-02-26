/**
 * Runtime helper for creating worker component refs by moduleId/name.
 * Used by Vite plugin codegen instead of inlining Symbol + factory.
 */
import { WORKER_REFERENCE_SYMBOL } from "./constants";

export function createWorkerRef(componentId: string, moduleId: string, name: string) {
  const ref = function () {
    throw new Error(
      "[rsc-prism] Worker component references cannot render on the main thread. Pass the imported symbol to fetchRSC(...).",
    );
  };
  const tagged = ref as unknown as {
    $$typeof: symbol;
    $$id: string;
    $$moduleId: string;
    $$name: string;
  };
  tagged.$$typeof = WORKER_REFERENCE_SYMBOL;
  tagged.$$id = componentId;
  tagged.$$moduleId = moduleId;
  tagged.$$name = name;
  return ref;
}
