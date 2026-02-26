/**
 * Encode action arguments to FormData or JSON string for transport.
 * Uses low-level wire format from flight-runtime.
 */

import { binaryWireTagFromKind, encodeWireValueWithBinaryRows } from "../flight-runtime/wire";

export async function encodeReply(value: unknown): Promise<FormData | string> {
  let nextBinaryPartId = 1;
  let formData: FormData | null = null;
  const encoded = encodeWireValueWithBinaryRows(value, (kind, bytes) => {
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
  });

  if (formData == null) {
    return JSON.stringify(encoded);
  }
  (formData as FormData).append("0", JSON.stringify(encoded));
  return formData as FormData;
}
