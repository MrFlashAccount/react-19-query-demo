import type { Color, SpanId, SpanState } from "../../types";

export const DEFAULT_SPAN_CAPACITY = 2048;
export const DEFAULT_STRING_CAPACITY = 256 * 1024;

export type SpanStatusCode = 0 | 1 | 2 | 3;
export type ColorCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const STATUS_TO_CODE: Record<SpanState, SpanStatusCode> = {
  inactive: 0,
  running: 1,
  success: 2,
  error: 3,
};

export const CODE_TO_STATUS: Record<SpanStatusCode, SpanState> = {
  0: "inactive",
  1: "running",
  2: "success",
  3: "error",
};

export const COLOR_TO_CODE: Record<Color, ColorCode> = {
  primary: 0,
  "primary-light": 1,
  "primary-dark": 2,
  secondary: 3,
  "secondary-light": 4,
  "secondary-dark": 5,
  tertiary: 6,
  "tertiary-light": 7,
  "tertiary-dark": 8,
  error: 9,
};

export const CODE_TO_COLOR: Record<ColorCode, Color> = {
  0: "primary",
  1: "primary-light",
  2: "primary-dark",
  3: "secondary",
  4: "secondary-light",
  5: "secondary-dark",
  6: "tertiary",
  7: "tertiary-light",
  8: "tertiary-dark",
  9: "error",
};

const HEADER_INTS = 3;
const HEADER_BYTES = HEADER_INTS * 4;
const HEADER_COUNT_INDEX = 0;
const HEADER_CAPACITY_INDEX = 1;
const HEADER_VERSION_INDEX = 2;

export const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface SpanBufferViews {
  count: Int32Array;
  capacity: number;
  version: Int32Array;
  startTime: Float64Array;
  endTime: Float64Array;
  depth: Uint16Array;
  status: Uint8Array;
  color: Uint8Array;
  parentIndex: Int32Array;
  nameOff: Uint32Array;
  nameLen: Uint16Array;
  spanId: BigUint64Array;
  stringBytes: Uint8Array;
  sab: SharedArrayBuffer;
  stringSab: SharedArrayBuffer;
}

export interface SpanBufferDescriptor {
  sab: SharedArrayBuffer;
  stringSab: SharedArrayBuffer;
}

export interface SpanBufferWriteInput {
  spanId: SpanId;
  parentIndex: number;
  name: string;
  startTime: number;
  endTime: number;
  depth: number;
  status: SpanState;
  color?: Color;
}

function align(offset: number, alignment: number): number {
  const remainder = offset % alignment;
  return remainder === 0 ? offset : offset + (alignment - remainder);
}

function getNumericBufferByteLength(capacity: number): number {
  let offset = HEADER_BYTES;
  offset = align(offset, 8);
  offset += capacity * 8 * 2; // start/end
  offset += capacity * 8; // spanId (BigUint64)
  offset = align(offset, 4);
  offset += capacity * 4; // parentIndex
  offset += capacity * 4; // nameOff
  offset = align(offset, 2);
  offset += capacity * 2; // nameLen
  offset += capacity * 2; // depth
  offset = align(offset, 1);
  offset += capacity * 1; // status
  offset += capacity * 1; // color
  return align(offset, 8);
}

function createViews(
  sab: SharedArrayBuffer,
  stringSab: SharedArrayBuffer
): SpanBufferViews {
  const header = new Int32Array(sab, 0, HEADER_INTS);
  const capacity = header[HEADER_CAPACITY_INDEX];
  let offset = HEADER_BYTES;
  offset = align(offset, 8);
  const startTime = new Float64Array(sab, offset, capacity);
  offset += capacity * 8;
  const endTime = new Float64Array(sab, offset, capacity);
  offset += capacity * 8;
  const spanId = new BigUint64Array(sab, offset, capacity);
  offset += capacity * 8;
  offset = align(offset, 4);
  const parentIndex = new Int32Array(sab, offset, capacity);
  offset += capacity * 4;
  const nameOff = new Uint32Array(sab, offset, capacity);
  offset += capacity * 4;
  offset = align(offset, 2);
  const nameLen = new Uint16Array(sab, offset, capacity);
  offset += capacity * 2;
  const depth = new Uint16Array(sab, offset, capacity);
  offset += capacity * 2;
  const status = new Uint8Array(sab, offset, capacity);
  offset += capacity * 1;
  const color = new Uint8Array(sab, offset, capacity);

  return {
    count: new Int32Array(sab, 0, 1),
    capacity,
    version: new Int32Array(sab, 8, 1),
    startTime,
    endTime,
    spanId,
    depth,
    status,
    color,
    parentIndex,
    nameOff,
    nameLen,
    stringBytes: new Uint8Array(stringSab),
    sab,
    stringSab,
  };
}

export function createSpanBuffer(
  capacity: number = DEFAULT_SPAN_CAPACITY,
  stringCapacity: number = DEFAULT_STRING_CAPACITY
): SpanBufferViews {
  const byteLength = getNumericBufferByteLength(capacity);
  const sab = new SharedArrayBuffer(byteLength);
  const header = new Int32Array(sab, 0, HEADER_INTS);
  header[HEADER_COUNT_INDEX] = 0;
  header[HEADER_CAPACITY_INDEX] = capacity;
  header[HEADER_VERSION_INDEX] = 0;
  const stringSab = new SharedArrayBuffer(stringCapacity);
  return createViews(sab, stringSab);
}

export function attachSpanBuffer(
  sab: SharedArrayBuffer,
  stringSab: SharedArrayBuffer
): SpanBufferViews {
  return createViews(sab, stringSab);
}

export function getSpansCount(views: SpanBufferViews): number {
  return Atomics.load(views.count, 0);
}

export function bumpSpanVersion(views: SpanBufferViews): number {
  return Atomics.add(views.version, 0, 1) + 1;
}

export function readSpanId(views: SpanBufferViews, index: number): SpanId {
  return views.spanId[index] as SpanId;
}

export function readSpanName(views: SpanBufferViews, index: number): string {
  const offset = views.nameOff[index];
  const len = views.nameLen[index];
  // Copy to regular ArrayBuffer - TextDecoder doesn't support SharedArrayBuffer views
  const copy = new Uint8Array(len);
  copy.set(views.stringBytes.subarray(offset, offset + len));
  return decoder.decode(copy);
}

/** Compute duration from start/end times. For running spans (status=1), use performance.now(). */
export function readDuration(views: SpanBufferViews, index: number): number {
  const end =
    views.status[index] === 1 ? performance.now() : views.endTime[index];
  return end - views.startTime[index];
}

export function writeSpanId(
  views: SpanBufferViews,
  index: number,
  spanId: SpanId
): void {
  views.spanId[index] = spanId;
}

export function encodeName(
  views: SpanBufferViews,
  index: number,
  name: string,
  stringOffset: number
): number {
  const bytes = encoder.encode(name);
  views.stringBytes.set(bytes, stringOffset);
  views.nameOff[index] = stringOffset;
  views.nameLen[index] = bytes.length;
  return stringOffset + bytes.length;
}

export function cloneSpanBuffer(
  prev: SpanBufferViews,
  nextCapacity: number,
  nextStringCapacity: number
): SpanBufferViews {
  const next = createSpanBuffer(nextCapacity, nextStringCapacity);
  const count = getSpansCount(prev);
  next.startTime.set(prev.startTime.subarray(0, count));
  next.endTime.set(prev.endTime.subarray(0, count));
  next.spanId.set(prev.spanId.subarray(0, count));
  next.depth.set(prev.depth.subarray(0, count));
  next.status.set(prev.status.subarray(0, count));
  next.color.set(prev.color.subarray(0, count));
  next.parentIndex.set(prev.parentIndex.subarray(0, count));
  next.nameOff.set(prev.nameOff.subarray(0, count));
  next.nameLen.set(prev.nameLen.subarray(0, count));
  next.stringBytes.set(prev.stringBytes);
  Atomics.store(next.count, 0, count);
  Atomics.store(next.version, 0, Atomics.load(prev.version, 0));
  return next;
}
