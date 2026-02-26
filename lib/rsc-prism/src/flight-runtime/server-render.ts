/**
 * Server-side Flight rendering: React tree to stream or row emitter.
 */

import type { ReactNode } from "react";
import type { FlightServerRenderOptions } from "./types";
import {
  createEncodeContext,
  encodeServerNode,
  encodeFlightRow,
  encodeBinaryFlightRow,
  isThenable,
  type FlightRowEmit,
} from "./server-encode";
import {
  flightBinaryRow,
  flightDoneRow,
  flightErrorRow,
  flightMetadataRow,
  flightModelRow,
} from "./wire";

const FLIGHT_ROW_ENCODER = new TextEncoder();

export async function renderToReadableStream(
  element: ReactNode,
  _moduleBasePath: unknown,
  options?: FlightServerRenderOptions,
): Promise<ReadableStream<Uint8Array>> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const signal = options?.signal;
      if (signal?.aborted) {
        controller.error(signal.reason);
        return;
      }

      let settled = false;
      const onAbort = () => {
        if (settled) return;
        settled = true;
        controller.error(signal?.reason);
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      try {
        const pendingRows = new Set<Promise<void>>();
        const queueDeferred = (task: Promise<void>): void => {
          pendingRows.add(task);
          void task.finally(() => {
            pendingRows.delete(task);
          });
        };
        const context = createEncodeContext(
          {
            get settled() {
              return settled;
            },
            emitModelRow(id, value) {
              controller.enqueue(encodeFlightRow(id, value));
            },
            emitMetadataRow(id, revivePaths, templates) {
              const payload =
                templates != null && templates.length > 0
                  ? { revivePaths, templates }
                  : { revivePaths };
              controller.enqueue(
                FLIGHT_ROW_ENCODER.encode(`M${id.toString(16)}:${JSON.stringify(payload)}\n`),
              );
            },
            emitBinaryRow(id, kind, bytes) {
              controller.enqueue(encodeBinaryFlightRow(id, kind, bytes));
            },
          },
          queueDeferred,
        );

        context.preparePathsForEncode();
        const rootEncoded = encodeServerNode(element, context);
        const root = isThenable(rootEncoded) ? await rootEncoded : rootEncoded;
        if (settled) return;
        context.emitRow(0, root);

        while (pendingRows.size > 0) {
          await Promise.race(pendingRows);
          if (settled) return;
        }

        controller.close();
        settled = true;
      } catch (error) {
        if (!settled) {
          settled = true;
          controller.error(error);
        }
      } finally {
        signal?.removeEventListener("abort", onAbort);
      }
    },
  });
}

export async function renderToRowEmitter(
  element: ReactNode,
  _moduleBasePath: unknown,
  emit: FlightRowEmit,
  options?: FlightServerRenderOptions,
): Promise<void> {
  const signal = options?.signal;
  if (signal?.aborted) {
    emit(flightErrorRow(String(signal.reason)));
    return;
  }

  let settled = false;
  const onAbort = () => {
    if (settled) return;
    settled = true;
    emit(flightErrorRow(String(signal?.reason)));
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const pendingRows = new Set<Promise<void>>();
    const queueDeferred = (task: Promise<void>): void => {
      pendingRows.add(task);
      void task.finally(() => {
        pendingRows.delete(task);
      });
    };
    const context = createEncodeContext(
      {
        get settled() {
          return settled;
        },
        emitModelRow(id, value) {
          emit(flightModelRow(id, value));
        },
        emitMetadataRow(id, revivePaths, templates) {
          emit(flightMetadataRow(id, revivePaths, templates));
        },
        emitBinaryRow(id, kind, bytes) {
          const { row, transfer } = flightBinaryRow(id, kind, bytes);
          emit(row, transfer);
        },
      },
      queueDeferred,
    );

    context.preparePathsForEncode();
    const rootEncoded = encodeServerNode(element, context);
    const root = isThenable(rootEncoded) ? await rootEncoded : rootEncoded;
    if (settled) return;
    context.emitRow(0, root);

    while (pendingRows.size > 0) {
      await Promise.race(pendingRows);
      if (settled) return;
    }

    emit(flightDoneRow());
    settled = true;
  } catch (error) {
    if (!settled) {
      settled = true;
      const message = error instanceof Error ? error.message : String(error);
      emit(flightErrorRow(message));
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}
