/**
 * Action args extraction from worker postMessage (no Request/Response).
 */

import type { EncodedActionArgs } from "../types";
import type { WorkerTransportRequestMessage } from "../worker-components/types";

/**
 * Derive EncodedActionArgs from a worker transport message (body).
 */
export function encodedArgsFromMessage(message: WorkerTransportRequestMessage): EncodedActionArgs {
  return { type: "object", data: message.body };
}
