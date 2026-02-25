/**
 * Global keys used by plugin-generated runtime bootstrap and client helpers.
 */
import type { FlightRowMessage } from "./flight-runtime/wire";

export const WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY = "__rscPrismBootstrapWorkerRuntime";
export const DEFAULT_WORKER_RUNTIME_GLOBAL_KEY = "__rscPrismDefaultWorkerRuntime";
export const INVALIDATE_RSC_GLOBAL_KEY = "__rscPrismInvalidateRSC";
export const MAIN_THREAD_MODULES_GLOBAL_KEY = "__rscPrismMainThreadModules";
export const RSC_REFRESH_RUNTIME_GLOBAL_KEY = "__rscPrismRSCRefreshRuntime";

export interface RSCRefreshTarget {
  targetKey: string;
  componentId: string;
  componentProps: unknown;
}

export interface RSCRefreshBatchEntry {
  targetKey: string;
  rows?: FlightRowMessage[];
  error?: string;
}

export interface RSCRefreshBatch {
  seq: number;
  entries: RSCRefreshBatchEntry[];
}

export interface RSCRefreshRuntime {
  collectTargets: () => RSCRefreshTarget[];
  applyBatch: (batch: RSCRefreshBatch) => void;
  legacyInvalidate: () => void;
}

export function setInvalidateRSC(invalidateRSC: () => void): void {
  // @ts-expect-error - globalThis[INVALIDATE_RSC_GLOBAL_KEY] is defined in the runtime-globals.ts file
  globalThis[INVALIDATE_RSC_GLOBAL_KEY] = invalidateRSC;
}

export function setMainThreadModules(modules: Record<string, unknown>): void {
  // @ts-expect-error - globalThis[MAIN_THREAD_MODULES_GLOBAL_KEY] is defined in the runtime-globals.ts file
  globalThis[MAIN_THREAD_MODULES_GLOBAL_KEY] = modules;
}

export function setRSCRefreshRuntime(runtime: RSCRefreshRuntime): void {
  // @ts-expect-error - globalThis[RSC_REFRESH_RUNTIME_GLOBAL_KEY] is defined in the runtime-globals.ts file
  globalThis[RSC_REFRESH_RUNTIME_GLOBAL_KEY] = runtime;
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

let requestSequence = 0;

export function createTraceRequestId(prefix: string = "rsc"): string {
  requestSequence += 1;
  return `${prefix}-${Date.now()}-${requestSequence}`;
}

export function getRSCRefreshRuntimeOrNull(): RSCRefreshRuntime | null {
  // @ts-expect-error - globalThis[RSC_REFRESH_RUNTIME_GLOBAL_KEY] is defined in the runtime-globals.ts file
  const runtime = globalThis[RSC_REFRESH_RUNTIME_GLOBAL_KEY];
  if (runtime == null) {
    return null;
  }
  return runtime as RSCRefreshRuntime;
}
