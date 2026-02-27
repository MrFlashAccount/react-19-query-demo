/**
 * Decode action reply from postMessage (structured-clone payload).
 * Uses low-level wire format from flight-runtime.
 */

import { decodeWireValue } from "../flight-runtime/wire";

export async function decodeReply(
  body: unknown,
  _moduleBasePath: unknown,
  options?: {
    currentRowId?: number;
    /** Ref table for resolving numeric client ref ids. Required when action args may contain client refs. */
    refTable?: unknown[];
  },
): Promise<unknown> {
  const parsed =
    typeof body === "string" ? (JSON.parse(body) as { v?: unknown; p?: (string | number)[][] }) : body;
  const refTable = options?.refTable;
  const payload = parsed != null && "v" in parsed && Array.isArray(parsed?.p) ? parsed.v : parsed;
  const revivePaths =
    parsed != null && "v" in parsed && Array.isArray(parsed?.p) ? parsed.p : undefined;
  return decodeWireValue(
    payload,
    (id: number) => {
      if (refTable == null) {
        throw new Error(
          `[rsc-prism] Numeric client ref id ${id} cannot be resolved. Pass refTable in decodeReply options.`,
        );
      }
      const resolved = refTable[id];
      if (resolved === undefined) {
        throw new Error(`[rsc-prism] Unknown client ref id ${id} in decodeReply.`);
      }
      return resolved;
    },
    undefined,
    undefined,
    { ...options, revivePaths },
  );
}
