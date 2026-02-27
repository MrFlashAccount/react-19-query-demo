/**
 * Encode action arguments to FormData or JSON string for transport.
 * Uses low-level wire format from flight-runtime.
 */

import { binaryWireTagFromKind, encodeWireValueWithBinaryRows } from "../flight-runtime/wire";

export async function encodeReply(value: unknown): Promise<FormData | string> {
  let nextBinaryPartId = 1;
  let formData: FormData | null = null;
  const revivePaths: (string | number)[][] = [];
  const encoded = encodeWireValueWithBinaryRows(
    value,
    (kind, bytes) => {
      const id = nextBinaryPartId;
      nextBinaryPartId += 1;
      const tag = binaryWireTagFromKind(kind);
      if (formData == null) {
        formData = new FormData();
      }
      const binaryPart = new Uint8Array(bytes.byteLength);
      binaryPart.set(bytes);
      formData.append(`${id}:${tag}`, new Blob([binaryPart]));
      return `${id}:${tag}`;
    },
    new WeakSet(),
    { pushRevivePath: (path) => revivePaths.push([...path]) },
  );

  const payload: unknown = revivePaths.length > 0 ? { v: encoded, p: revivePaths } : encoded;

  if (formData == null) {
    return JSON.stringify(payload);
  }
  (formData as FormData).append("0", JSON.stringify(payload));
  return formData as FormData;
}
