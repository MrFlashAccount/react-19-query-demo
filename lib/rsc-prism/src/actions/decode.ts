/**
 * Decode encoded action arguments back to JavaScript values.
 */

import { resolveClientManifestOrThrow } from "../runtime/client-manifest";
import type { EncodedActionArgs } from "../types";
import { defaultFlightProtocolAdapter } from "./adapter";

export async function decodeActionArgs(encoded: EncodedActionArgs): Promise<unknown[]> {
  const manifest = resolveClientManifestOrThrow();
  const decoded = await defaultFlightProtocolAdapter.decodeActionArgs(encoded, manifest);
  return Array.isArray(decoded) ? decoded : [decoded];
}
