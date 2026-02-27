/**
 * Decode action reply (FormData or string) to JavaScript values.
 * Uses low-level wire format from flight-runtime.
 */

import { decodeBinaryWireRow, decodeWireValue } from "../flight-runtime/wire";

export async function decodeReply(
  body: FormData | string,
  _moduleBasePath: unknown,
  options?: {
    currentRowId?: number;
    /** Ref table for resolving numeric client ref ids. Required when action args may contain client refs. */
    refTable?: unknown[];
  },
): Promise<unknown> {
  let source = "null";
  const rowsById = new Map<string, unknown>();
  if (typeof body === "string") {
    source = body;
  } else {
    const pendingRows: Array<Promise<void>> = [];
    for (const [key, value] of body.entries()) {
      if (key === "0") {
        source = typeof value === "string" ? value : "";
        continue;
      }
      const separatorIndex = key.lastIndexOf(":");
      if (separatorIndex === -1) {
        continue;
      }
      const rowTag = key.slice(separatorIndex + 1);
      if (
        (typeof File !== "undefined" && value instanceof File) ||
        (typeof Blob !== "undefined" && value instanceof Blob)
      ) {
        pendingRows.push(
          value.arrayBuffer().then((arrayBuffer) => {
            rowsById.set(key, decodeBinaryWireRow(rowTag, new Uint8Array(arrayBuffer)));
          }),
        );
      }
    }
    if (pendingRows.length > 0) {
      await Promise.all(pendingRows);
    }
  }
  const parsed = JSON.parse(source);
  const refTable = options?.refTable;
  const payload = parsed?.v != null && Array.isArray(parsed?.p) ? parsed.v : parsed;
  const revivePaths = parsed?.v != null && Array.isArray(parsed?.p) ? parsed.p : undefined;
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
    (id) => rowsById.get(id),
    undefined,
    { ...options, revivePaths },
  );
}
