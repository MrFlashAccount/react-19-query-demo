/**
 * Action args extraction from worker postMessage (no Request/Response).
 */

import type { EncodedActionArgs } from "../types";
import type { WorkerTransportRequestMessage } from "../worker-components/types";

/**
 * Derive EncodedActionArgs from a worker transport message (body + contentType).
 */
export function encodedArgsFromMessage(
  message: WorkerTransportRequestMessage,
): EncodedActionArgs {
  const body = message.body;
  if (body instanceof FormData) {
    return { type: "formdata", data: body };
  }
  const str = typeof body === "string" ? body : "";
  return { type: "string", data: str };
}
