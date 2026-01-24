/**
 * Safari Polyfill for RSC Streams
 *
 * Safari doesn't implement ReadableByteStreamController, which RSC requires.
 * This polyfill must be awaited BEFORE any RSC operations.
 *
 * Usage:
 * ```ts
 * await polyfillReady;
 * // Now safe to use RSC
 * ```
 */

/**
 * Promise that resolves when the polyfill is loaded (if needed)
 * Safe to await multiple times - resolves immediately if polyfill not needed
 */
export const polyfillReady: Promise<void> =
  typeof globalThis.ReadableByteStreamController === "undefined"
    ? import("web-streams-polyfill").then(({ ReadableStream }) => {
        globalThis.ReadableStream = ReadableStream as typeof globalThis.ReadableStream;
      })
    : Promise.resolve();

/**
 * Check if polyfill was needed
 */
export function isPolyfillRequired(): boolean {
  return typeof globalThis.ReadableByteStreamController === "undefined";
}
