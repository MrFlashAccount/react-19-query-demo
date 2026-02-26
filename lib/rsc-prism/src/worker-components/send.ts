/**
 * Worker transport request sending (stream response).
 */

import {
  DEFAULT_REQUEST_TYPE,
  DEFAULT_RESPONSE_TYPE,
  WORKER_RESPONSE_KIND_HEAD,
  WORKER_RESPONSE_KIND_NEXT,
  WORKER_RESPONSE_KIND_DONE,
  WORKER_RESPONSE_KIND_ERROR,
} from "./constants";
import { createWorkerResponseTypeMap, normalizeWorkerResponseMessage } from "./decode";
import { createWorkerRequestEnvelope } from "./encode";
import { getWorkerEndpointState } from "./endpoint";
import { nextRequestId, toHeaderTuples } from "./shared";
import type {
  WorkerMessageEndpoint,
  WorkerTransportRequestMessage,
  WorkerTransportOptions,
} from "./types";

export { nextRequestId, toHeaderTuples };

export function sendWorkerRequest(
  endpoint: WorkerMessageEndpoint,
  request: Omit<WorkerTransportRequestMessage, "id" | "type">,
  options: WorkerTransportOptions = {},
  requestId?: string,
): Promise<Response> {
  const requestType = options.requestType ?? DEFAULT_REQUEST_TYPE;
  const responseType = options.responseType ?? DEFAULT_RESPONSE_TYPE;
  const responseTypeMap = createWorkerResponseTypeMap(responseType);
  const timeoutMs = options.timeoutMs ?? 10000;
  const id = requestId ?? nextRequestId();
  const endpointState = getWorkerEndpointState(endpoint);

  return new Promise<Response>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let didResolveHead = false;
    let isSettled = false;
    let streamDone = false;
    let streamError: Error | null = null;
    let lastActivity = Date.now();
    const pendingChunks: Uint8Array[] = [];

    const cleanup = (): void => {
      endpointState.pending.delete(id);
      if (timer != null) clearTimeout(timer);
    };

    const closeStream = (): void => {
      if (streamDone) return;
      streamDone = true;
      if (streamController != null) {
        streamController.close();
      }
    };

    const failStream = (error: Error): void => {
      if (streamDone) return;
      streamDone = true;
      if (streamController != null) {
        streamController.error(error);
      } else {
        streamError = error;
      }
    };

    const touchActivity = () => {
      lastActivity = Date.now();
    };

    const watchTimeout = () => {
      if (timeoutMs <= 0) return;
      const elapsed = Date.now() - lastActivity;
      const remaining = timeoutMs - elapsed;

      if (remaining > 0) {
        timer = setTimeout(watchTimeout, remaining);
        return;
      }

      const timeoutError = new Error(`Worker transport timed out after ${timeoutMs}ms`);
      if (!didResolveHead) {
        cleanup();
        isSettled = true;
        reject(timeoutError);
        return;
      }

      cleanup();
      failStream(timeoutError);
    };

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
        for (const chunk of pendingChunks) {
          controller.enqueue(chunk);
        }
        pendingChunks.length = 0;

        if (streamError != null) {
          controller.error(streamError);
          return;
        }

        if (streamDone) {
          controller.close();
        }
      },
      cancel() {
        cleanup();
      },
    });

    endpointState.pending.set(id, {
      touchActivity,
      handleMessage: (data) => {
        const message = normalizeWorkerResponseMessage(data, responseTypeMap);
        switch (message.kind) {
          case WORKER_RESPONSE_KIND_HEAD:
            if (didResolveHead || isSettled) return;
            didResolveHead = true;
            isSettled = true;
            resolve(
              new Response(stream, {
                status: message.status,
                headers: message.headers,
              }),
            );
            return;
          case WORKER_RESPONSE_KIND_NEXT:
            if (!didResolveHead || streamDone || message.chunk == null) return;
            if (streamController != null) {
              streamController.enqueue(message.chunk);
            } else {
              pendingChunks.push(message.chunk);
            }
            return;
          case WORKER_RESPONSE_KIND_DONE:
            if (!didResolveHead || streamDone) return;
            cleanup();
            closeStream();
            return;
          case WORKER_RESPONSE_KIND_ERROR: {
            const error = new Error(message.error);
            cleanup();
            if (!didResolveHead && !isSettled) {
              isSettled = true;
              reject(error);
            } else {
              failStream(error);
            }
            return;
          }
          default:
            return;
        }
      },
    });

    if (timeoutMs > 0) {
      timer = setTimeout(watchTimeout, timeoutMs);
    }

    endpoint.postMessage(createWorkerRequestEnvelope(requestType, id, request));
  });
}
