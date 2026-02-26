/**
 * Worker transport message type constants.
 */

export const DEFAULT_REQUEST_TYPE = "rsc.transport.request";
export const DEFAULT_RESPONSE_TYPE = "rsc.transport.response";
export const DEFAULT_ROW_RESPONSE_TYPE = "rsc.transport.response.row";
export const WORKER_STREAM_CHUNK_BATCH_BYTES = 32 * 1024;

export const WORKER_RESPONSE_KIND_UNKNOWN = 0;
export const WORKER_RESPONSE_KIND_HEAD = 1;
export const WORKER_RESPONSE_KIND_NEXT = 2;
export const WORKER_RESPONSE_KIND_DONE = 3;
export const WORKER_RESPONSE_KIND_ERROR = 4;

export function responseHeadType(baseType: string): string {
  return `${baseType}.head`;
}

export function responseNextType(baseType: string): string {
  return `${baseType}.next`;
}

export function responseDoneType(baseType: string): string {
  return `${baseType}.done`;
}

export function responseErrorType(baseType: string): string {
  return `${baseType}.error`;
}
