/**
 * Global keys used by plugin-generated runtime bootstrap and client helpers.
 */
export const WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY = "__rscPrismBootstrapWorkerRuntime";
export const DEFAULT_WORKER_RUNTIME_GLOBAL_KEY = "__rscPrismDefaultWorkerRuntime";
export const INVALIDATE_RSC_GLOBAL_KEY = "__rscPrismInvalidateRSC";
export const MAIN_THREAD_MODULES_GLOBAL_KEY = "__rscPrismMainThreadModules";

export function setInvalidateRSC(invalidateRSC: () => void): void {
  // @ts-expect-error - globalThis[INVALIDATE_RSC_GLOBAL_KEY] is defined in the runtime-globals.ts file
  globalThis[INVALIDATE_RSC_GLOBAL_KEY] = invalidateRSC;
}

export function setMainThreadModules(modules: Record<string, unknown>): void {
  // @ts-expect-error - globalThis[MAIN_THREAD_MODULES_GLOBAL_KEY] is defined in the runtime-globals.ts file
  globalThis[MAIN_THREAD_MODULES_GLOBAL_KEY] = modules;
}

export function getInvalidateRSC(): () => void {
  // @ts-expect-error - globalThis[INVALIDATE_RSC_GLOBAL_KEY] is defined in the runtime-globals.ts file
  const invalidateRSC = globalThis[INVALIDATE_RSC_GLOBAL_KEY];
  if (invalidateRSC == null) {
    throw new Error(
      "Invalidate RSC is not available. This is likely a bug in the RSC Prism runtime.",
    );
  }
  return invalidateRSC;
}

export function getMainThreadModules(): Record<string, unknown> {
  // @ts-expect-error - globalThis[MAIN_THREAD_MODULES_GLOBAL_KEY] is defined in the runtime-globals.ts file
  const modules = globalThis[MAIN_THREAD_MODULES_GLOBAL_KEY];
  if (modules == null) {
    throw new Error(
      "Main thread modules are not available. This is likely a bug in the RSC Prism runtime.",
    );
  }
  return modules;
}
