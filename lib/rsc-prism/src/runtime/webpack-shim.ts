// @ts-nocheck
/**
 * Webpack Shim for RSC
 *
 * react-server-dom-webpack internally uses webpack's module system.
 * This shim provides the required globals for RSC to work in any environment
 * (Service Worker, Web Worker, main thread).
 *
 * IMPORTANT: This file must be imported BEFORE any react-server-dom-webpack imports.
 */

const g = globalThis as Record<string, unknown>;

/**
 * Module cache - stores loaded client modules
 * Used by __webpack_require__ to resolve module references
 */
export const moduleCache: Record<string, { exports?: unknown }> = {};

// Set up webpack globals
g.__webpack_module_cache__ = moduleCache;

/**
 * Module loader - retrieves modules from cache
 * Called by RSC when resolving client module references
 */
g.__webpack_require__ = (moduleId: string): unknown => {
  const cached = moduleCache[moduleId];
  if (cached) return cached.exports ?? cached;
  throw new Error(`[rsc-sw-bff] Module "${moduleId}" not found in webpack cache`);
};

/**
 * Chunk loading - no-op for service worker environment
 * All modules should already be loaded/registered
 */
g.__webpack_chunk_load__ = (): Promise<void> => Promise.resolve();

/**
 * Script filename getter - used for dynamic imports
 * Returns empty string as we don't use dynamic chunk loading
 */
g.__webpack_get_script_filename__ = (): string => "";

/**
 * Public path - base URL for loading chunks
 */
g.__webpack_public_path__ = "/";

/**
 * Async chunk handler - handles async module loading
 * Resolves immediately since all modules are pre-registered
 */
g.__webpack_require__.e = (): Promise<void> => Promise.resolve();

/**
 * Module factory wrapper
 */
g.__webpack_require__.r = (exports: Record<string, unknown>): void => {
  if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  }
  Object.defineProperty(exports, "__esModule", { value: true });
};

/**
 * Define getter function for ES modules
 */
g.__webpack_require__.d = (
  exports: Record<string, unknown>,
  definition: Record<string, () => unknown>,
): void => {
  for (const key in definition) {
    if (
      Object.prototype.hasOwnProperty.call(definition, key) &&
      !Object.prototype.hasOwnProperty.call(exports, key)
    ) {
      Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
    }
  }
};

/**
 * Create a fake namespace object for non-ES modules
 */
g.__webpack_require__.t = (value: unknown, mode: number): unknown => {
  if (mode & 1) value = (g.__webpack_require__ as (id: string) => unknown)(value as string);
  if (mode & 8) return value;
  if (
    mode & 4 &&
    typeof value === "object" &&
    value &&
    (value as { __esModule?: boolean }).__esModule
  )
    return value;
  const ns = Object.create(null);
  g.__webpack_require__.r(ns);
  Object.defineProperty(ns, "default", { enumerable: true, value });
  if (mode & 2 && typeof value !== "string") {
    for (const key in value as Record<string, unknown>) {
      g.__webpack_require__.d(ns, {
        [key]: () => (value as Record<string, unknown>)[key],
      });
    }
  }
  return ns;
};

// Type declarations for TypeScript
declare global {
  // biome-ignore lint/style/noVar: <Global declaration requires var>
  var __webpack_module_cache__: Record<string, { exports?: unknown }>;
  // biome-ignore lint/style/noVar: <Global declaration requires var>
  var __webpack_require__: ((moduleId: string) => unknown) & {
    e: () => Promise<void>;
    r: (exports: Record<string, unknown>) => void;
    d: (exports: Record<string, unknown>, definition: Record<string, () => unknown>) => void;
    t: (value: unknown, mode: number) => unknown;
  };
  // biome-ignore lint/style/noVar: <Global declaration requires var>
  var __webpack_chunk_load__: () => Promise<void>;
  // biome-ignore lint/style/noVar: <Global declaration requires var>
  var __webpack_get_script_filename__: () => string;
  // biome-ignore lint/style/noVar: <Global declaration requires var>
  var __webpack_public_path__: string;
}
