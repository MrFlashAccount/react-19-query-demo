/**
 * Worker transport message handlers (worker-side). PostMessage-only, no Request/Response streaming.
 */

import type { FlightRowMessage } from "../flight-runtime/wire";
import { flightErrorRow, ROW_DONE, ROW_ERROR } from "../flight-runtime/wire";
import { DEFAULT_REQUEST_TYPE, DEFAULT_ROW_RESPONSE_TYPE } from "./constants";
import { normalizeIncomingWorkerTransportRequest } from "./decode";
import { resolveReplyTarget } from "./shared";
import type {
  MessageEventListener,
  WorkerTransportRequestMessage,
  WorkerRowResponseMessage,
  WorkerTransportOptions,
  WorkerActionRefreshBatchMessage,
} from "./types";

export type WorkerRowTransportRequestHandler = (
  request: WorkerTransportRequestMessage,
  emit: (row: FlightRowMessage, transfer?: Transferable[]) => void,
  controls: {
    setActionRefreshBatch: (batch: WorkerActionRefreshBatchMessage) => void;
  },
) => Promise<void> | void;

export function createWorkerRowTransportMessageHandler(
  handler: WorkerRowTransportRequestHandler,
  options: WorkerTransportOptions = {},
): MessageEventListener {
  const requestType = options.requestType ?? DEFAULT_REQUEST_TYPE;
  const rowResponseType = options.responseType ?? DEFAULT_ROW_RESPONSE_TYPE;

  return async (event: MessageEvent<unknown>) => {
    const request = normalizeIncomingWorkerTransportRequest(event.data, requestType);
    if (request == null) return;

    const replyTarget = resolveReplyTarget(event);
    if (replyTarget == null) {
      return;
    }

    const pendingRows: FlightRowMessage[] = [];
    const pendingTransfer: Transferable[] = [];
    let pendingActionRefreshBatch: WorkerActionRefreshBatchMessage | null = null;
    let flushScheduled = false;
    let closed = false;
    const flush = (): void => {
      flushScheduled = false;
      if (pendingRows.length === 0 && pendingActionRefreshBatch == null) {
        return;
      }
      const message: WorkerRowResponseMessage = {
        type: rowResponseType,
        id: request.id,
        rows: pendingRows.splice(0, pendingRows.length),
      };
      if (pendingActionRefreshBatch != null) {
        message.actionRefreshBatch = pendingActionRefreshBatch;
        pendingActionRefreshBatch = null;
      }
      const transfer =
        pendingTransfer.length === 0
          ? undefined
          : pendingTransfer.splice(0, pendingTransfer.length);
      replyTarget.postMessage(message, transfer);
    };
    const scheduleFlush = (): void => {
      if (flushScheduled) {
        return;
      }
      flushScheduled = true;
      queueMicrotask(flush);
    };
    const emit = (row: FlightRowMessage, transfer?: Transferable[]): void => {
      if (closed) {
        return;
      }
      pendingRows.push(row);
      if (transfer != null && transfer.length > 0) {
        pendingTransfer.push(...transfer);
      }
      if (row.k === ROW_DONE || row.k === ROW_ERROR) {
        closed = true;
        flush();
        return;
      }
      scheduleFlush();
    };
    const setActionRefreshBatch = (batch: WorkerActionRefreshBatchMessage): void => {
      pendingActionRefreshBatch = batch;
      scheduleFlush();
    };

    try {
      await handler(request, emit, { setActionRefreshBatch });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit(flightErrorRow(message));
    }
  };
}
