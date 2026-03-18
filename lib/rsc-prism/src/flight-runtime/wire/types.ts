/**
 * Wire format types for Flight encode/decode.
 *
 * Context interfaces are intentionally minimal to keep hot-path overhead low;
 * optional callbacks use explicit undefined checks rather than optional chaining.
 */
import { ROW_BINARY, ROW_DONE, ROW_ERROR, ROW_METADATA, ROW_MODEL } from "./constants";

export type JsonObject = Record<string, unknown>;

export type EmitBinaryRow = (kind: string, bytes: Uint8Array) => string | number;
export type StreamEmitBinaryRow = (kind: string, bytes: Uint8Array) => number;

/**
 * Context for stream encoding. Mutates values in-place where possible to avoid
 * allocations; outlineValue/emitBinaryRow defer large values to separate rows.
 */
export interface StreamEncodeContext {
  outlineValue: (value: unknown) => number;
  emitBinaryRow: StreamEmitBinaryRow;
  seen: WeakSet<object>;
  currentRowId?: number;
  /** collect path for inline revival; client uses paths for direct replacement */
  pushReviveValue: (encoded: string, path: (string | number)[]) => void;
  /** Current path (set by caller for path collection) */
  _path: (string | number)[];
}

/**
 * Context for stream decoding. Chunk type is generic so the client can use
 * its own chunk representation (e.g. unresolved promises) without forcing
 * materialization.
 */
export interface StreamDecodeContext<Chunk = unknown> {
  getChunk: (id: number) => Chunk;
  readChunk: (chunk: Chunk) => unknown;
  createLazyChunkWrapper: (chunk: Chunk) => unknown;
  resolveClientReference: (id: number) => unknown;
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>;
  getCurrentRowId?: () => number | undefined;
}

/** Template row shape for streaming deduplication; id maps to outline storage. */
export interface FlightTemplateRowShape {
  id: number;
  shape: unknown;
}

/** Discriminated union of Flight row kinds; k is the discriminant for fast dispatch. */
export type FlightRowMessage =
  | { k: typeof ROW_MODEL; id: number; v: unknown }
  | { k: typeof ROW_BINARY; id: number; t: string; v: ArrayBuffer }
  | { k: typeof ROW_DONE }
  | { k: typeof ROW_ERROR; v: string }
  | {
      id: number;
      k: typeof ROW_METADATA;
      revivePaths: ReadonlyArray<(string | number)[]>;
    };
