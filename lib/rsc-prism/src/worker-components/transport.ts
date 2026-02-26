/**
 * Worker transport creation (client-side). PostMessage-only, no Request/Response streaming.
 */

import { getInvalidateRSC, getRSCRefreshRuntimeOrNull } from "../runtime-globals";
import { createFromRowEmitter } from "../flight-runtime/client";
import type { FlightClientOptions } from "../flight-runtime/types";
import { flightErrorRow, ROW_DONE, ROW_ERROR } from "../flight-runtime/wire";
import { DEFAULT_REQUEST_TYPE, DEFAULT_ROW_RESPONSE_TYPE } from "./constants";
import { createWorkerRequestEnvelope } from "./encode";
import { getWorkerEndpointState } from "./endpoint";
import { normalizeWorkerRowMessage } from "./decode";
import { nextRequestId, toHeaderTuples } from "./shared";
import type {
  RSCTransport,
  SendActionInput,
  FetchRSCInput,
  WorkerMessageEndpoint,
  WorkerTransportRequestMessage,
  WorkerTransportOptions,
  WorkerActionRefreshBatchMessage,
} from "./types";

export function createWorkerRowTransport(
  endpoint: WorkerMessageEndpoint,
  options: WorkerTransportOptions = {},
): RSCTransport {
  const requestType = options.requestType ?? DEFAULT_REQUEST_TYPE;
  const rowResponseType = options.responseType ?? DEFAULT_ROW_RESPONSE_TYPE;
  const timeoutMs = options.timeoutMs ?? 10000;
  const endpointState = getWorkerEndpointState(endpoint);
  let actionRefreshDispatchSeq = 0;
  let actionRefreshAppliedSeq = 0;

  function sendRowRequest<T>(
    request: Omit<WorkerTransportRequestMessage, "id" | "type">,
    hooks?: {
      onActionRefreshBatch?: (batch: WorkerActionRefreshBatchMessage) => void;
    },
    clientOptions?: FlightClientOptions,
  ): Promise<T> {
    const id = nextRequestId();
    const emitter = createFromRowEmitter<T>(clientOptions);

    return new Promise<T>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let lastActivity = Date.now();
      let rootSettled = false;
      let streamSettled = false;

      const cleanup = (): void => {
        endpointState.pending.delete(id);
        if (timer != null) {
          clearTimeout(timer);
        }
      };

      const fail = (error: Error): void => {
        if (streamSettled) return;
        streamSettled = true;
        cleanup();
        emitter.push(flightErrorRow(error.message));
        if (!rootSettled) {
          rootSettled = true;
          reject(error);
        }
      };

      const touchActivity = (): void => {
        lastActivity = Date.now();
      };

      const watchTimeout = (): void => {
        if (timeoutMs <= 0) return;
        const elapsed = Date.now() - lastActivity;
        const remaining = timeoutMs - elapsed;
        if (remaining > 0) {
          timer = setTimeout(watchTimeout, remaining);
          return;
        }
        fail(new Error(`Worker transport timed out after ${timeoutMs}ms`));
      };

      endpointState.pending.set(id, {
        touchActivity,
        handleMessage: (data) => {
          const message = normalizeWorkerRowMessage(data, rowResponseType);
          if (!message.matchedType) {
            return;
          }
          if (message.actionRefreshBatch != null && hooks?.onActionRefreshBatch != null) {
            hooks.onActionRefreshBatch(message.actionRefreshBatch);
          }
          if (message.rows.length === 0) {
            return;
          }
          for (let i = 0; i < message.rows.length; i += 1) {
            const row = message.rows[i];
            emitter.push(row);
            if (row.k === ROW_DONE || row.k === ROW_ERROR) {
              streamSettled = true;
              cleanup();
              break;
            }
          }
        },
      });

      emitter.result.then(
        (value) => {
          if (rootSettled) return;
          rootSettled = true;
          resolve(value);
        },
        (error) => {
          if (rootSettled) return;
          rootSettled = true;
          cleanup();
          reject(error);
        },
      );

      if (timeoutMs > 0) {
        timer = setTimeout(watchTimeout, timeoutMs);
      }

      endpoint.postMessage(createWorkerRequestEnvelope(requestType, id, request));
    });
  }

  return {
    fetchRSCDirect<T>(input: FetchRSCInput, clientOptions?: FlightClientOptions): Promise<T> {
      const requestId = nextRequestId();
      const headers = new Headers(input.headers);
      headers.set("accept", "text/x-component");
      headers.set("x-rsc-request-id", requestId);
      return sendRowRequest<T>(
        {
          operation: "fetch",
          endpoint: input.url,
          headers: toHeaderTuples(headers),
          requestInit: input.requestInit,
          componentId: input.componentId,
          componentProps: input.componentProps,
        },
        undefined,
        clientOptions,
      );
    },
    sendActionDirect<T>(input: SendActionInput, clientOptions?: FlightClientOptions): Promise<T> {
      const invalidateRSC = getInvalidateRSC();
      const refreshRuntime =
        options.experimentalActionBatchRefresh === true ? getRSCRefreshRuntimeOrNull() : null;
      const refreshTargets = refreshRuntime?.collectTargets() ?? [];
      const refreshBatchSeq =
        refreshRuntime != null && refreshTargets.length > 0
          ? ++actionRefreshDispatchSeq
          : undefined;
      let sawBatchMetadata = false;
      const requestId = nextRequestId();
      const headers = new Headers(input.headers);
      headers.set("x-rsc-request-id", requestId);
      return sendRowRequest<T>(
        {
          operation: "action",
          endpoint: input.endpoint,
          actionId: input.actionId,
          contentType: input.contentType,
          headers: toHeaderTuples(headers),
          body: input.body,
          requestInit: input.requestInit,
          refreshTargets: refreshTargets.length > 0 ? refreshTargets : undefined,
          refreshBatchSeq,
        },
        {
          onActionRefreshBatch: (batch) => {
            if (refreshRuntime == null) {
              return;
            }
            sawBatchMetadata = true;
            if (batch.seq < actionRefreshAppliedSeq) {
              return;
            }
            actionRefreshAppliedSeq = batch.seq;
            refreshRuntime.applyBatch({
              seq: batch.seq,
              entries: batch.entries.map((entry) => ({
                targetKey: entry.targetKey,
                rows: entry.rows,
                error: entry.error,
              })),
            });
          },
        },
        clientOptions,
      ).finally(() => {
        if (sawBatchMetadata) {
          return;
        }
        if (refreshRuntime != null) {
          if (refreshBatchSeq != null) {
            return;
          }
          refreshRuntime.legacyInvalidate();
          return;
        }
        invalidateRSC();
      });
    },
  };
}
