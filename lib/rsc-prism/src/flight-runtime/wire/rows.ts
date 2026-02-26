/**
 * Flight row constructors: produce the canonical row shapes for the wire protocol.
 *
 * flightBinaryRow returns transfer list so postMessage can transfer ArrayBuffers
 * without copying. Other rows are plain objects for JSON serialization.
 */
import type { FlightRowMessage, FlightTemplateRowShape } from "./types";
import type { RevivePathTree } from "./path-tree";
import { ROW_BINARY, ROW_DONE, ROW_ERROR, ROW_METADATA, ROW_MODEL } from "./constants";
import { binaryWireTagFromKind } from "./binary";

/** Ensures buffer is transferable (not a view into SharedArrayBuffer); required for postMessage. */
function toTransferableBuffer(bytes: Uint8Array): ArrayBuffer {
  const start = bytes.byteOffset;
  const end = bytes.byteOffset + bytes.byteLength;
  const backing = bytes.buffer;
  if (backing instanceof ArrayBuffer) {
    return backing.slice(start, end);
  }
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  return copied.buffer;
}

export function flightModelRow(id: number, value: unknown): FlightRowMessage {
  return { k: ROW_MODEL, id, v: value };
}

export function flightMetadataRow(
  id: number,
  revivePathTree: RevivePathTree,
  templates?: FlightTemplateRowShape[],
): FlightRowMessage {
  return templates != null && templates.length > 0
    ? { k: ROW_METADATA, id, revivePaths: revivePathTree, templates }
    : { k: ROW_METADATA, id, revivePaths: revivePathTree };
}

/** Returns row + transfer list; caller must pass transfer to postMessage for zero-copy. */
export function flightBinaryRow(
  id: number,
  kind: string,
  bytes: Uint8Array,
): { row: FlightRowMessage; transfer: Transferable[] } {
  const tag = binaryWireTagFromKind(kind);
  const buffer = toTransferableBuffer(bytes);
  return {
    row: { k: ROW_BINARY, id, t: tag, v: buffer },
    transfer: [buffer],
  };
}

export function flightDoneRow(): FlightRowMessage {
  return { k: ROW_DONE };
}

/** Emits error payload; transport should close stream after this. */
export function flightErrorRow(message: string): FlightRowMessage {
  return { k: ROW_ERROR, v: message };
}
