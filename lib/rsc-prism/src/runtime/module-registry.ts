/**
 * Module Registry - Client Component Registration
 *
 * Registers client component modules in the webpack cache
 * so RSC can resolve client references during hydration.
 *
 * IMPORTANT: Import webpack-shim before this module:
 * ```ts
 * import './rsc/webpack-shim';
 * import { registerClientModule } from './rsc/module-registry';
 * ```
 */

import { moduleCache } from "./webpack-shim";
import type { ClientManifest } from "../types";

/**
 * Register a client module in the webpack cache
 *
 * @example
 * ```ts
 * import * as ClientComponents from './components';
 * registerClientModule('client', ClientComponents);
 * ```
 */
export function registerClientModule(moduleId: string, moduleExports: unknown): void {
  moduleCache[moduleId] = { exports: moduleExports };
}

/**
 * Register multiple client modules at once
 *
 * @example
 * ```ts
 * registerClientModules({
 *   'client': ClientComponents,
 *   'utils': ClientUtils,
 * });
 * ```
 */
export function registerClientModules(modules: Record<string, unknown>): void {
  for (const [id, exports] of Object.entries(modules)) {
    registerClientModule(id, exports);
  }
}

/**
 * Check if a module is registered
 */
export function hasModule(moduleId: string): boolean {
  return moduleId in moduleCache;
}

/**
 * Get a registered module (throws if not found)
 */
export function getModule<T = unknown>(moduleId: string): T {
  const cached = moduleCache[moduleId];
  if (!cached) {
    throw new Error(`Module "${moduleId}" not registered`);
  }
  return cached.exports as T;
}

/**
 * Build a client manifest from export names
 *
 * @example
 * ```ts
 * const manifest = buildClientManifest('client', ['Counter', 'Button', 'Form']);
 * // Result:
 * // {
 * //   'client': { id: 'client', chunks: [], name: '*' },
 * //   'client#Counter': { id: 'client', chunks: [], name: 'Counter' },
 * //   'client#Button': { id: 'client', chunks: [], name: 'Button' },
 * //   'client#Form': { id: 'client', chunks: [], name: 'Form' },
 * // }
 * ```
 */
export function buildClientManifest(moduleId: string, exportNames: string[]): ClientManifest {
  const manifest: ClientManifest = {
    [moduleId]: { id: moduleId, chunks: [], name: "*" },
  };

  for (const name of exportNames) {
    manifest[`${moduleId}#${name}`] = { id: moduleId, chunks: [], name };
  }

  return manifest;
}

/**
 * Build a client manifest from a module's exports
 *
 * @example
 * ```ts
 * import * as ClientComponents from './components';
 * const manifest = buildClientManifestFromModule('client', ClientComponents);
 * ```
 */
export function buildClientManifestFromModule(
  moduleId: string,
  moduleExports: Record<string, unknown>,
): ClientManifest {
  const exportNames = Object.keys(moduleExports).filter(
    (key) => typeof moduleExports[key] === "function",
  );
  return buildClientManifest(moduleId, exportNames);
}

/**
 * Merge multiple manifests into one
 */
export function mergeManifests(...manifests: ClientManifest[]): ClientManifest {
  return Object.assign({}, ...manifests);
}

// Re-export types
export type { ClientManifest };
