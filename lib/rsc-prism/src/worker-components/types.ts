/**
 * Worker transport types.
 */

import type { FlightRowMessage } from "../flight-runtime/wire";
import type { FlightClientOptions } from "../flight-runtime/types";

export interface SendActionInput {
  endpoint: string;
  actionId: string;
  body: BodyInit;
  contentType?: string;
  headers?: HeadersInit;
  requestInit?: Omit<RequestInit, "method" | "body" | "headers">;
}

export interface FetchRSCInput {
  url: string;
  headers?: HeadersInit;
  requestInit?: Omit<RequestInit, "headers">;
  componentId?: string;
  componentProps?: unknown;
}

export interface RSCTransport {
  sendAction(input: SendActionInput): Promise<Response>;
  fetchRSC?(input: FetchRSCInput): Promise<Response>;
  fetchRSCDirect?<T>(input: FetchRSCInput, clientOptions?: FlightClientOptions): Promise<T>;
  sendActionDirect?<T>(input: SendActionInput, clientOptions?: FlightClientOptions): Promise<T>;
}

export type MessageEventListener = (event: MessageEvent<unknown>) => void;

export interface WorkerMessageEndpoint {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: MessageEventListener): void;
  removeEventListener(type: "message", listener: MessageEventListener): void;
}

export interface WorkerTransportRequestMessage {
  type: string;
  id: string;
  operation: "action" | "fetch";
  endpoint: string;
  actionId?: string;
  contentType?: string;
  headers?: [string, string][];
  body?: BodyInit;
  requestInit?: Omit<RequestInit, "method" | "body" | "headers">;
  componentId?: string;
  componentProps?: unknown;
  refreshTargets?: WorkerRefreshTargetMessage[];
  refreshBatchSeq?: number;
}

export interface WorkerTransportResponseMessage {
  type: string;
  id: string;
}

export interface WorkerTransportResponseHeadMessage extends WorkerTransportResponseMessage {
  status: number;
  headers?: [string, string][];
}

export interface WorkerTransportResponseNextMessage extends WorkerTransportResponseMessage {
  chunk: Uint8Array;
}

export interface WorkerTransportResponseDoneMessage extends WorkerTransportResponseMessage {}

export interface WorkerTransportResponseErrorMessage extends WorkerTransportResponseMessage {
  error: string;
}

export interface WorkerRowResponseMessage {
  type: string;
  id: string;
  rows: FlightRowMessage[];
  actionRefreshBatch?: WorkerActionRefreshBatchMessage;
}

export interface WorkerTransportOptions {
  requestType?: string;
  responseType?: string;
  timeoutMs?: number;
  experimentalActionBatchRefresh?: boolean;
}

export interface WorkerRefreshTargetMessage {
  targetKey: string;
  componentId: string;
  componentProps: unknown;
}

export interface WorkerActionRefreshBatchEntryMessage {
  targetKey: string;
  rows?: FlightRowMessage[];
  error?: string;
}

export interface WorkerActionRefreshBatchMessage {
  seq: number;
  entries: WorkerActionRefreshBatchEntryMessage[];
}

export interface WorkerResponseTypeMap {
  head: string;
  next: string;
  done: string;
  error: string;
}
