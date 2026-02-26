/**
 * Worker transport message handlers (worker-side).
 */

import type { FlightRowMessage } from "../flight-runtime/wire";
import { flightErrorRow, ROW_DONE, ROW_ERROR } from "../flight-runtime/wire";
import {
  DEFAULT_REQUEST_TYPE,
  DEFAULT_RESPONSE_TYPE,
  DEFAULT_ROW_RESPONSE_TYPE,
  WORKER_STREAM_CHUNK_BATCH_BYTES,
} from "./constants";
import { createWorkerResponseTypeMap, normalizeIncomingWorkerTransportRequest } from "./decode";
import { concatUint8Chunks, resolveReplyTarget } from "./shared";
import { transferListForChunk } from "./shared";
import type {
  MessageEventListener,
  WorkerTransportRequestMessage,
  WorkerTransportResponseHeadMessage,
  WorkerTransportResponseNextMessage,
  WorkerTransportResponseDoneMessage,
  WorkerTransportResponseErrorMessage,
  WorkerRowResponseMessage,
  WorkerTransportOptions,
  WorkerActionRefreshBatchMessage,
} from "./types";

export type WorkerTransportRequestHandler = (
  request: WorkerTransportRequestMessage,
) => Promise<Response> | Response;

export function createWorkerTransportMessageHandler(
  handler: WorkerTransportRequestHandler,
  options: WorkerTransportOptions = {},
): MessageEventListener {
  const requestType = options.requestType ?? DEFAULT_REQUEST_TYPE;
  const responseType = options.responseType ?? DEFAULT_RESPONSE_TYPE;
  const responseTypeMap = createWorkerResponseTypeMap(responseType);

  return async (event: MessageEvent<unknown>) => {
    const request = normalizeIncomingWorkerTransportRequest(event.data, requestType);
    if (request == null) return;

    const replyTarget = resolveReplyTarget(event);
    if (replyTarget == null) {
      return;
    }

    try {
      const response = await handler(request);
      replyTarget.postMessage({
        type: responseTypeMap.head,
        id: request.id,
        status: response.status,
        headers: [...response.headers.entries()],
      } satisfies WorkerTransportResponseHeadMessage);

      if (response.body != null) {
        const reader = response.body.getReader();
        try {
          const chunkBatch: Uint8Array[] = [];
          let batchBytes = 0;
          const flushBatch = (): void => {
            if (chunkBatch.length === 0) {
              return;
            }
            const chunk = concatUint8Chunks(chunkBatch, batchBytes);
            const transfer = transferListForChunk(chunk);
            replyTarget.postMessage(
              {
                type: responseTypeMap.next,
                id: request.id,
                chunk,
              } satisfies WorkerTransportResponseNextMessage,
              transfer,
            );
            chunkBatch.length = 0;
            batchBytes = 0;
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              flushBatch();
              break;
            }
            chunkBatch.push(value);
            batchBytes += value.byteLength;
            if (batchBytes >= WORKER_STREAM_CHUNK_BATCH_BYTES) {
              flushBatch();
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      replyTarget.postMessage({
        type: responseTypeMap.done,
        id: request.id,
      } satisfies WorkerTransportResponseDoneMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      replyTarget.postMessage({
        type: responseTypeMap.error,
        id: request.id,
        error: message,
      } satisfies WorkerTransportResponseErrorMessage);
    }
  };
}

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
