/**
 * Binary wire format: typed arrays and ArrayBuffers are serialized as raw bytes
 * with a single-character tag. We prefer view-over-buffer when alignment permits
 * to avoid extra copies; otherwise we copy for correct alignment.
 */
import { toArrayBuffer } from "./shared";

/**
 * Reconstructs a TypedArray from raw bytes. Uses a view when byteOffset/byteLength
 * are aligned to avoid copying; Int16Array etc require 2-byte alignment.
 */
export function rehydrateTypedArray(kind: string, bytes: Uint8Array): unknown {
  const toCopiedBuffer = (): ArrayBuffer =>
    toArrayBuffer(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const canUseView = (alignment: number): boolean =>
    bytes.byteOffset % alignment === 0 && bytes.byteLength % alignment === 0;
  switch (kind) {
    case "Uint8Array":
      return bytes;
    case "Int8Array":
      return new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    case "Uint8ClampedArray":
      return new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    case "Int16Array":
      if (canUseView(2)) {
        return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      }
      return new Int16Array(toCopiedBuffer());
    case "Uint16Array":
      if (canUseView(2)) {
        return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      }
      return new Uint16Array(toCopiedBuffer());
    case "Int32Array":
      if (canUseView(4)) {
        return new Int32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      }
      return new Int32Array(toCopiedBuffer());
    case "Uint32Array":
      if (canUseView(4)) {
        return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      }
      return new Uint32Array(toCopiedBuffer());
    case "Float32Array":
      if (canUseView(4)) {
        return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      }
      return new Float32Array(toCopiedBuffer());
    case "Float64Array":
      if (canUseView(8)) {
        return new Float64Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 8);
      }
      return new Float64Array(toCopiedBuffer());
    case "BigInt64Array":
      if (canUseView(8)) {
        return new BigInt64Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 8);
      }
      return new BigInt64Array(toCopiedBuffer());
    case "BigUint64Array":
      if (canUseView(8)) {
        return new BigUint64Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 8);
      }
      return new BigUint64Array(toCopiedBuffer());
    case "DataView":
      return new DataView(toCopiedBuffer());
    default:
      throw new Error(`Unsupported typed array kind "${kind}"`);
  }
}

/** Returns the backing buffer when it's a contiguous ArrayBuffer; otherwise copies to avoid shared views. */
export function rehydrateArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer;
  }
  return toArrayBuffer(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** Maps single-char wire tags to TypedArray kind names; compact to minimize payload. */
function binaryWireTagToKind(tag: string): string {
  switch (tag) {
    case "O":
      return "Int8Array";
    case "U":
      return "Uint8ClampedArray";
    case "S":
      return "Int16Array";
    case "s":
      return "Uint16Array";
    case "L":
      return "Int32Array";
    case "l":
      return "Uint32Array";
    case "G":
      return "Float32Array";
    case "g":
      return "Float64Array";
    case "M":
      return "BigInt64Array";
    case "m":
      return "BigUint64Array";
    default:
      throw new Error(`Unknown binary row tag "${tag}"`);
  }
}

/** Dispatches on tag to rehydrate ArrayBuffer, DataView, or TypedArray from raw bytes. */
export function decodeBinaryWireRow(tag: string, bytes: Uint8Array): unknown {
  switch (tag) {
    case "A":
      return rehydrateArrayBuffer(bytes);
    case "o":
      return bytes;
    case "V":
      return new DataView(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      );
    default:
      return rehydrateTypedArray(binaryWireTagToKind(tag), bytes);
  }
}

/** Inverse of binaryWireTagToKind; used when encoding binary rows. */
export function binaryWireTagFromKind(kind: string): string {
  switch (kind) {
    case "ArrayBuffer":
      return "A";
    case "Uint8Array":
      return "o";
    case "Int8Array":
      return "O";
    case "Uint8ClampedArray":
      return "U";
    case "Int16Array":
      return "S";
    case "Uint16Array":
      return "s";
    case "Int32Array":
      return "L";
    case "Uint32Array":
      return "l";
    case "Float32Array":
      return "G";
    case "Float64Array":
      return "g";
    case "BigInt64Array":
      return "M";
    case "BigUint64Array":
      return "m";
    case "DataView":
      return "V";
    default:
      throw new Error(`Unsupported binary kind "${kind}"`);
  }
}

/** Fast check using char codes to avoid string allocation when parsing row prefixes. */
export function isBinaryWireRowTag(tag: number): boolean {
  return (
    tag === 65 || // A
    tag === 79 || // O
    tag === 111 || // o
    tag === 85 || // U
    tag === 83 || // S
    tag === 115 || // s
    tag === 76 || // L
    tag === 108 || // l
    tag === 71 || // G
    tag === 103 || // g
    tag === 77 || // M
    tag === 109 || // m
    tag === 86 // V
  );
}
