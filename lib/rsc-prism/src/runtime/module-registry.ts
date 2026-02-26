/**
 * ESM module registry helpers.
 *
 * In ESM mode React Flight resolves client references through `import(specifier)`.
 * We only keep lightweight helpers to normalize module ids and derive base URLs.
 */
import type { ClientManifest } from "../types";

/**
 * Legacy compatibility no-op.
 */
export function registerClientModule(_moduleId: string, _moduleExports: unknown): void {
  // No-op in ESM mode.
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
export function registerClientModules(_modules: Record<string, unknown>): void {
  // No-op in ESM mode.
}

/**
 * Check if a module is registered
 */
export function hasModule(moduleId: string): boolean {
  return moduleId.length > 0;
}

/**
 * Get a registered module (throws if not found)
 */
export function getModule<T = unknown>(moduleId: string): T {
  throw new Error(
    `Module "${moduleId}" cannot be synchronously resolved in ESM mode. Use dynamic import via React Flight resolution.`,
  );
}

/**
 * Derive manifest base URL from module id (path up to last slash, or "/" if none).
 */
export function buildClientManifestBaseUrl(moduleId: string): string {
  const normalizedModuleId = moduleId.split("#", 1)[0]!;
  const slashIndex = normalizedModuleId.lastIndexOf("/");
  return slashIndex === -1 ? "/" : normalizedModuleId.slice(0, slashIndex + 1);
}

/**
 * Build an ESM manifest base URL from a module id.
 */
export function buildClientManifest(moduleId: string, _exportNames: string[]): ClientManifest {
  return buildClientManifestBaseUrl(moduleId);
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
  _moduleExports: Record<string, unknown>,
): ClientManifest {
  return buildClientManifest(moduleId, []);
}

/**
 * Merge multiple manifests into one
 */
export function mergeManifests(...manifests: ClientManifest[]): ClientManifest {
  return (
    manifests.findLast((manifest) =>
      Array.isArray(manifest) ? manifest.length > 0 : Object.keys(manifest).length > 0,
    ) ?? "/"
  );
}

// Re-export types
export type { ClientManifest };
