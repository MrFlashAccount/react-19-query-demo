/**
 * Encode action arguments for postMessage transport.
 * Uses low-level wire format from flight-runtime. Structured-clone types
 * (Map, Set, Date, FormData, ArrayBuffer, etc.) pass through natively.
 */

import { encodeWireValue } from "../flight-runtime/wire";

export async function encodeReply(
  value: unknown,
): Promise<FormData | string | { v: unknown; p: (string | number)[][] }> {
  const revivePaths: (string | number)[][] = [];
  const encoded = encodeWireValue(value, {
    pushRevivePath: (path: (string | number)[]) => revivePaths.push([...path]),
  });
  return revivePaths.length > 0 ? { v: encoded, p: revivePaths } : (encoded as FormData | string);
}
