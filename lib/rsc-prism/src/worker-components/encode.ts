/**
 * Worker transport request envelope creation.
 */

import type { WorkerTransportRequestMessage } from "./types";

export function createWorkerRequestEnvelope(
  requestType: string,
  id: string,
  request: Omit<WorkerTransportRequestMessage, "id" | "type">,
): WorkerTransportRequestMessage {
  return {
    type: requestType,
    id,
    operation: request.operation,
    endpoint: request.endpoint,
    actionId: request.actionId ?? undefined,
    contentType: request.contentType ?? undefined,
    headers: request.headers ?? undefined,
    body: request.body ?? undefined,
    requestInit: request.requestInit ?? undefined,
    componentId: request.componentId ?? undefined,
    componentProps: request.componentProps,
    refreshTargets: request.refreshTargets ?? undefined,
    refreshBatchSeq: request.refreshBatchSeq ?? undefined,
  };
}
