import type { ReactNode } from "react";
import type { ClientManifest, EncodedActionArgs, RSCRenderOptions } from "../types";
import { createFromReadableStream, createFromRowEmitter, encodeReply } from "./client";
import {
  decodeReply,
  renderToReadableStream,
  renderToRowEmitter,
  type FlightRowEmit,
} from "./server";
import type { FlightRowMessage } from "./wire";

export interface FlightProtocolAdapter {
  renderStream(
    element: ReactNode,
    manifest: ClientManifest,
    options?: RSCRenderOptions,
  ): Promise<ReadableStream<Uint8Array>>;
  consumeStream<T = unknown>(
    stream: ReadableStream<Uint8Array>,
    manifest: ClientManifest,
    callServer?: (actionId: string, args: unknown[]) => Promise<unknown>,
  ): Promise<T>;
  renderRows?(
    element: ReactNode,
    manifest: ClientManifest,
    emit: FlightRowEmit,
    options?: RSCRenderOptions,
  ): Promise<void>;
  consumeRows?<T = unknown>(
    manifest: ClientManifest,
    callServer?: (actionId: string, args: unknown[]) => Promise<unknown>,
  ): {
    push: (row: FlightRowMessage) => void;
    result: Promise<T>;
  };
  encodeActionArgs(args: unknown[]): Promise<EncodedActionArgs>;
  decodeActionArgs(encoded: EncodedActionArgs, manifest: ClientManifest): Promise<unknown>;
}

export const defaultFlightProtocolAdapter: FlightProtocolAdapter = {
  renderStream(element, manifest, options) {
    return renderToReadableStream(element, manifest, options);
  },

  consumeStream(stream, manifest, callServer) {
    return createFromReadableStream(stream, {
      manifest,
      callServer,
    });
  },

  renderRows(element, manifest, emit, options) {
    return renderToRowEmitter(element, manifest, emit, options);
  },

  consumeRows(manifest, callServer) {
    return createFromRowEmitter({
      manifest,
      callServer,
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

    return decodeReply(body, manifest, {});
  },
};
