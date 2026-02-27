/**
 * Default Flight protocol adapter: wires low-level flight-runtime with action encode/decode.
 * PostMessage-only: row emitter for render, row consumer for decode.
 */

import type { ReactNode } from "react";
import type { ClientManifest, EncodedActionArgs, RSCRenderOptions } from "../types";
import type { FlightRowMessage } from "../flight-runtime/wire";
import { CLIENT_REF_TABLE_GLOBAL_KEY } from "../runtime-globals";
import { createFromRowEmitter } from "../flight-runtime/client";
import { renderToRowEmitter, type FlightRowEmit } from "../flight-runtime/server";
import { encodeReply } from "./encode-reply";
import { decodeReply } from "./decode-reply";

export interface FlightConsumeOptions {
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>;
}

export interface FlightProtocolAdapter {
  renderRows(
    element: ReactNode,
    manifest: ClientManifest,
    emit: FlightRowEmit,
    options?: RSCRenderOptions,
  ): Promise<void>;
  consumeRows<T = unknown>(
    manifest: ClientManifest,
    options?: FlightConsumeOptions,
  ): {
    push: (row: FlightRowMessage) => void;
    result: Promise<T>;
  };
  encodeActionArgs(args: unknown[]): Promise<EncodedActionArgs>;
  decodeActionArgs(encoded: EncodedActionArgs, manifest: ClientManifest): Promise<unknown>;
}

export const defaultFlightProtocolAdapter: FlightProtocolAdapter = {
  renderRows(element, manifest, emit, options) {
    return renderToRowEmitter(element, manifest, emit, options);
  },

  consumeRows(manifest, options) {
    return createFromRowEmitter({
      manifest,
      callServer: options?.callServer,
    });
  },

  async encodeActionArgs(args) {
    const encoded = await encodeReply(args);
    if (encoded instanceof FormData) {
      return {
        type: "formdata",
        data: encoded,
      };
    }
    return {
      type: "string",
      data: encoded as string,
    };
  },

  decodeActionArgs(encoded, manifest) {
    const body: FormData | string =
      encoded.type === "formdata"
        ? encoded.data instanceof FormData
          ? encoded.data
          : (() => {
              const formData = new FormData();
              for (const [key, value] of new URLSearchParams(encoded.data)) {
                formData.append(key, value);
              }
              return formData;
            })()
        : encoded.data;

    const refTable = (globalThis as Record<string, unknown>)[CLIENT_REF_TABLE_GLOBAL_KEY] as
      | unknown[]
      | undefined;
    return decodeReply(body, manifest, { refTable });
  },
};
