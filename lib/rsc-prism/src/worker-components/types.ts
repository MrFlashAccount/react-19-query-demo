/**
 * Worker transport types.
 */

import type { FlightRowMessage } from "../flight-runtime/wire";
import type { FlightClientOptions } from "../flight-runtime/types";

export interface SendActionInput {
  actionId: string;
  body: FormData | string;
}

export interface FetchRSCInput {
  componentId?: string;
  componentProps?: unknown;
}

export interface RSCTransport {
  fetchRSCDirect<T>(input: FetchRSCInput, clientOptions?: FlightClientOptions): Promise<T>;
  sendActionDirect<T>(input: SendActionInput, clientOptions?: FlightClientOptions): Promise<T>;
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
  actionId?: string;
  body?: FormData | string;
  componentId?: string;
  componentProps?: unknown;
  refreshTargets?: WorkerRefreshTargetMessage[];
  refreshBatchSeq?: number;
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
