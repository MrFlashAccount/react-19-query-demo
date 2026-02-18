import { getInvalidateRSC } from "./runtime-globals";
import { createFromRowEmitter } from "./flight-runtime/client";
import type { FlightClientOptions } from "./flight-runtime/types";
import {
  flightErrorRow,
  ROW_DONE,
  ROW_ERROR,
  type FlightRowMessage,
} from "./flight-runtime/wire";

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
  fetchRSCDirect?<T>(
    input: FetchRSCInput,
    clientOptions?: FlightClientOptions,
  ): Promise<T>;
  sendActionDirect?<T>(
    input: SendActionInput,
    clientOptions?: FlightClientOptions,
  ): Promise<T>;
}

export function createFetchTransport(): RSCTransport {
  return {
    async sendAction(input): Promise<Response> {
      const invalidateRSC = getInvalidateRSC();

      const headers = new Headers(input.headers);
      headers.set("x-rsc-action", input.actionId);
      if (input.contentType != null) {
        headers.set("content-type", input.contentType);
      }

      return fetch(input.endpoint, {
        method: "POST",
        body: input.body,
        headers,
        ...input.requestInit,
      }).finally(invalidateRSC);
    },

    async fetchRSC(input): Promise<Response> {
      const headers = new Headers(input.headers);
      headers.set("accept", "text/x-component");
      if (input.componentId != null) {
        headers.set("x-rsc-component-id", input.componentId);
      }
      if (input.componentProps !== undefined) {
        headers.set("x-rsc-component-props", JSON.stringify(input.componentProps));
      }

      return fetch(input.url, {
        headers,
        ...input.requestInit,
      });
    },
  };
}

export interface FunctionTransportRequest {
  method: "GET" | "POST";
  url: string;
  headers: Headers;
  body: BodyInit;
  requestInit?: RequestInit;
}

export type FunctionTransportHandler = (request: FunctionTransportRequest) => Promise<Response>;

export function createFunctionTransport(handler: FunctionTransportHandler): RSCTransport {
  return {
    async sendAction(input): Promise<Response> {
      const invalidateRSC = getInvalidateRSC();

      const headers = new Headers(input.headers);
      if (input.contentType != null) {
        headers.set("content-type", input.contentType);
      } else {
        headers.delete("content-type");
      }
      headers.set("x-rsc-action", input.actionId);
      return handler({
        method: "POST",
        url: input.endpoint,
        headers,
        body: input.body,
        requestInit: input.requestInit,
      }).finally(invalidateRSC);
    },

    async fetchRSC(input): Promise<Response> {
      const headers = new Headers(input.headers);
      headers.set("accept", "text/x-component");
      if (input.componentId != null) {
        headers.set("x-rsc-component-id", input.componentId);
      }
      if (input.componentProps !== undefined) {
        headers.set("x-rsc-component-props", JSON.stringify(input.componentProps));
      }
      return handler({
        method: "GET",
        url: input.url,
        headers,
        body: "",
        requestInit: input.requestInit,
      });
    },
  };
}

type MessageEventListener = (event: MessageEvent<unknown>) => void;

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
  row: FlightRowMessage;
}

export interface WorkerTransportOptions {
  requestType?: string;
  responseType?: string;
  timeoutMs?: number;
}

const DEFAULT_REQUEST_TYPE = "rsc.transport.request";
const DEFAULT_RESPONSE_TYPE = "rsc.transport.response";
const DEFAULT_ROW_RESPONSE_TYPE = "rsc.transport.response.row";
const WORKER_STREAM_CHUNK_BATCH_BYTES = 32 * 1024;
const WORKER_RESPONSE_KIND_UNKNOWN = 0;
const WORKER_RESPONSE_KIND_HEAD = 1;
const WORKER_RESPONSE_KIND_NEXT = 2;
const WORKER_RESPONSE_KIND_DONE = 3;
const WORKER_RESPONSE_KIND_ERROR = 4;

function responseHeadType(baseType: string): string {
  return `${baseType}.head`;
}

function responseNextType(baseType: string): string {
  return `${baseType}.next`;
}

function responseDoneType(baseType: string): string {
  return `${baseType}.done`;
}

function responseErrorType(baseType: string): string {
  return `${baseType}.error`;
}

interface WorkerResponseTypeMap {
  head: string;
  next: string;
  done: string;
  error: string;
}

interface NormalizedWorkerResponseMessage {
  kind:
    | typeof WORKER_RESPONSE_KIND_UNKNOWN
    | typeof WORKER_RESPONSE_KIND_HEAD
    | typeof WORKER_RESPONSE_KIND_NEXT
    | typeof WORKER_RESPONSE_KIND_DONE
    | typeof WORKER_RESPONSE_KIND_ERROR;
  status: number;
  headers: [string, string][] | undefined;
  chunk: Uint8Array | null;
  error: string;
}

interface NormalizedWorkerRowMessage {
  matchedType: boolean;
  row: FlightRowMessage | null;
}

function createWorkerResponseTypeMap(baseType: string): WorkerResponseTypeMap {
  return {
    head: responseHeadType(baseType),
    next: responseNextType(baseType),
    done: responseDoneType(baseType),
    error: responseErrorType(baseType),
  };
}

function normalizeWorkerResponseMessage(
  data: unknown,
  typeMap: WorkerResponseTypeMap,
): NormalizedWorkerResponseMessage {
  const message = data as Record<string, unknown> | null;
  if (message == null || typeof message.type !== "string") {
    return {
      kind: WORKER_RESPONSE_KIND_UNKNOWN,
      status: 0,
      headers: undefined,
      chunk: null,
      error: "",
    };
  }

  if (message.type === typeMap.head) {
    return {
      kind: WORKER_RESPONSE_KIND_HEAD,
      status: typeof message.status === "number" ? message.status : 200,
      headers: Array.isArray(message.headers)
        ? (message.headers as [string, string][])
        : undefined,
      chunk: null,
      error: "",
    };
  }

  if (message.type === typeMap.next) {
    return {
      kind: WORKER_RESPONSE_KIND_NEXT,
      status: 0,
      headers: undefined,
      chunk: message.chunk instanceof Uint8Array ? message.chunk : null,
      error: "",
    };
  }

  if (message.type === typeMap.done) {
    return {
      kind: WORKER_RESPONSE_KIND_DONE,
      status: 0,
      headers: undefined,
      chunk: null,
      error: "",
    };
  }

  if (message.type === typeMap.error) {
    return {
      kind: WORKER_RESPONSE_KIND_ERROR,
      status: 0,
      headers: undefined,
      chunk: null,
      error: typeof message.error === "string" ? message.error : "Unknown worker transport error",
    };
  }

  return {
    kind: WORKER_RESPONSE_KIND_UNKNOWN,
    status: 0,
    headers: undefined,
    chunk: null,
    error: "",
  };
}

function normalizeWorkerRowMessage(data: unknown, rowResponseType: string): NormalizedWorkerRowMessage {
  const message = data as Record<string, unknown> | null;
  if (message == null || message.type !== rowResponseType) {
    return {
      matchedType: false,
      row: null,
    };
  }
  const row = message.row as FlightRowMessage | null | undefined;
  return {
    matchedType: true,
    row: row ?? null,
  };
}

function createWorkerRequestEnvelope(
  requestType: string,
  id: string,
  request: Omit<WorkerTransportRequestMessage, "id" | "type">,
): WorkerTransportRequestMessage {
  return {
    type: requestType,
    id,
    operation: request.operation,
    endpoint: request.endpoint,
    actionId: request.actionId ?? undefined,
    contentType: request.contentType ?? undefined,
    headers: request.headers ?? undefined,
    body: request.body ?? undefined,
    requestInit: request.requestInit ?? undefined,
    componentId: request.componentId ?? undefined,
    componentProps: request.componentProps,
  };
}

function normalizeIncomingWorkerTransportRequest(
  data: unknown,
  requestType: string,
): WorkerTransportRequestMessage | null {
  const message = data as Record<string, unknown> | null;
  if (message == null || message.type !== requestType || typeof message.id !== "string") {
    return null;
  }
  const operation = message.operation;
  if (operation !== "action" && operation !== "fetch") {
    return null;
  }
  if (typeof message.endpoint !== "string") {
    return null;
  }
  return {
    type: requestType,
    id: message.id,
    operation,
    endpoint: message.endpoint,
    actionId: typeof message.actionId === "string" ? message.actionId : undefined,
    contentType: typeof message.contentType === "string" ? message.contentType : undefined,
    headers: Array.isArray(message.headers) ? (message.headers as [string, string][]) : undefined,
    body: (message.body as BodyInit | undefined) ?? undefined,
    requestInit: (message.requestInit as Omit<RequestInit, "method" | "body" | "headers"> | undefined) ?? undefined,
    componentId: typeof message.componentId === "string" ? message.componentId : undefined,
    componentProps: message.componentProps,
  };
}

let requestCounter = 0;

function nextRequestId(): string {
  requestCounter += 1;
  return `rsc-${Date.now()}-${requestCounter}`;
}

function toHeaderTuples(headers?: HeadersInit): [string, string][] {
  return [...new Headers(headers).entries()];
}

function transferListForChunk(chunk: Uint8Array): Transferable[] | undefined {
  if (chunk.byteLength === 0) return undefined;
  const buffer = chunk.buffer;
  if (!(buffer instanceof ArrayBuffer)) return undefined;
  return [buffer];
}

function concatUint8Chunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0];
  }
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

interface PendingWorkerRequest {
  touchActivity: () => void;
  handleMessage: (message: unknown) => void;
}

interface WorkerEndpointState {
  pending: Map<string, PendingWorkerRequest>;
}

const workerEndpointState = new WeakMap<WorkerMessageEndpoint, WorkerEndpointState>();

function getWorkerEndpointState(endpoint: WorkerMessageEndpoint): WorkerEndpointState {
  const existing = workerEndpointState.get(endpoint);
  if (existing) {
    return existing;
  }

  const state: WorkerEndpointState = {
    pending: new Map(),
  };

  endpoint.addEventListener("message", (event) => {
    const message = event.data as Record<string, unknown> | null;
    if (
      message == null ||
      typeof message.id !== "string" ||
      typeof message.type !== "string"
    ) {
      return;
    }

    const pending = state.pending.get(message.id);
    if (!pending) {
      return;
    }

    pending.touchActivity();
    pending.handleMessage(message);
  });

  workerEndpointState.set(endpoint, state);
  return state;
}

function sendWorkerRequest(
  endpoint: WorkerMessageEndpoint,
  request: Omit<WorkerTransportRequestMessage, "id" | "type">,
  options: WorkerTransportOptions = {},
): Promise<Response> {
  const requestType = options.requestType ?? DEFAULT_REQUEST_TYPE;
  const responseType = options.responseType ?? DEFAULT_RESPONSE_TYPE;
  const responseTypeMap = createWorkerResponseTypeMap(responseType);
  const timeoutMs = options.timeoutMs ?? 10000;
  const id = nextRequestId();
  const endpointState = getWorkerEndpointState(endpoint);

  return new Promise<Response>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let didResolveHead = false;
    let isSettled = false;
    let streamDone = false;
    let streamError: Error | null = null;
    let lastActivity = Date.now();
    const pendingChunks: Uint8Array[] = [];

    const cleanup = (): void => {
      endpointState.pending.delete(id);
      if (timer != null) clearTimeout(timer);
    };

    const closeStream = (): void => {
      if (streamDone) return;
      streamDone = true;
      if (streamController != null) {
        streamController.close();
      }
    };

    const failStream = (error: Error): void => {
      if (streamDone) return;
      streamDone = true;
      if (streamController != null) {
        streamController.error(error);
      } else {
        streamError = error;
      }
    };

    const touchActivity = () => {
      lastActivity = Date.now();
    };

    const watchTimeout = () => {
      if (timeoutMs <= 0) return;
      const elapsed = Date.now() - lastActivity;
      const remaining = timeoutMs - elapsed;

      if (remaining > 0) {
        timer = setTimeout(watchTimeout, remaining);
        return;
      }

      const timeoutError = new Error(`Worker transport timed out after ${timeoutMs}ms`);
      if (!didResolveHead) {
        cleanup();
        isSettled = true;
        reject(timeoutError);
        return;
      }

      cleanup();
      failStream(timeoutError);
    };

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
        for (const chunk of pendingChunks) {
          controller.enqueue(chunk);
        }
        pendingChunks.length = 0;

        if (streamError != null) {
          controller.error(streamError);
          return;
        }

        if (streamDone) {
          controller.close();
        }
      },
      cancel() {
        cleanup();
      },
    });

    endpointState.pending.set(id, {
      touchActivity,
      handleMessage: (data) => {
        const message = normalizeWorkerResponseMessage(data, responseTypeMap);
        switch (message.kind) {
          case WORKER_RESPONSE_KIND_HEAD:
            if (didResolveHead || isSettled) return;
            didResolveHead = true;
            isSettled = true;
            resolve(
              new Response(stream, {
                status: message.status,
                headers: message.headers,
              }),
            );
            return;
          case WORKER_RESPONSE_KIND_NEXT:
            if (!didResolveHead || streamDone || message.chunk == null) return;
            if (streamController != null) {
              streamController.enqueue(message.chunk);
            } else {
              pendingChunks.push(message.chunk);
            }
            return;
          case WORKER_RESPONSE_KIND_DONE:
            if (!didResolveHead || streamDone) return;
            cleanup();
            closeStream();
            return;
          case WORKER_RESPONSE_KIND_ERROR: {
            const error = new Error(message.error);
            cleanup();
            if (!didResolveHead && !isSettled) {
              isSettled = true;
              reject(error);
            } else {
              failStream(error);
            }
            return;
          }
          default:
            return;
        }
      },
    });

    if (timeoutMs > 0) {
      timer = setTimeout(watchTimeout, timeoutMs);
    }

    endpoint.postMessage(createWorkerRequestEnvelope(requestType, id, request));
  });
}

export function createWorkerTransport(
  endpoint: WorkerMessageEndpoint,
  options: WorkerTransportOptions = {},
): RSCTransport {
  return {
    async sendAction(input): Promise<Response> {
      const invalidateRSC = getInvalidateRSC();

      return sendWorkerRequest(
        endpoint,
        {
          operation: "action",
          endpoint: input.endpoint,
          actionId: input.actionId,
          contentType: input.contentType,
          headers: toHeaderTuples(input.headers),
          body: input.body,
          requestInit: input.requestInit,
        },
        options,
      ).finally(() => invalidateRSC());
    },

    async fetchRSC(input): Promise<Response> {
      const headers = new Headers(input.headers);
      headers.set("accept", "text/x-component");
      return sendWorkerRequest(
        endpoint,
        {
          operation: "fetch",
          endpoint: input.url,
          headers: toHeaderTuples(headers),
          requestInit: input.requestInit,
          componentId: input.componentId,
          componentProps: input.componentProps,
        },
        options,
      );
    },
  };
}

export function createWorkerRowTransport(
  endpoint: WorkerMessageEndpoint,
  options: WorkerTransportOptions = {},
): RSCTransport {
  const baseTransport = createWorkerTransport(endpoint, options);
  const requestType = options.requestType ?? DEFAULT_REQUEST_TYPE;
  const rowResponseType = options.responseType ?? DEFAULT_ROW_RESPONSE_TYPE;
  const timeoutMs = options.timeoutMs ?? 10000;
  const endpointState = getWorkerEndpointState(endpoint);

  function sendRowRequest<T>(
    request: Omit<WorkerTransportRequestMessage, "id" | "type">,
    clientOptions?: FlightClientOptions,
  ): Promise<T> {
    const id = nextRequestId();
    const emitter = createFromRowEmitter<T>(clientOptions);

    return new Promise<T>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let lastActivity = Date.now();
      let rootSettled = false;
      let streamSettled = false;

      const cleanup = (): void => {
        endpointState.pending.delete(id);
        if (timer != null) {
          clearTimeout(timer);
        }
      };

      const fail = (error: Error): void => {
        if (streamSettled) return;
        streamSettled = true;
        cleanup();
        emitter.push(flightErrorRow(error.message));
        if (!rootSettled) {
          rootSettled = true;
          reject(error);
        }
      };

      const touchActivity = (): void => {
        lastActivity = Date.now();
      };

      const watchTimeout = (): void => {
        if (timeoutMs <= 0) return;
        const elapsed = Date.now() - lastActivity;
        const remaining = timeoutMs - elapsed;
        if (remaining > 0) {
          timer = setTimeout(watchTimeout, remaining);
          return;
        }
        fail(new Error(`Worker transport timed out after ${timeoutMs}ms`));
      };

      endpointState.pending.set(id, {
        touchActivity,
        handleMessage: (data) => {
          const message = normalizeWorkerRowMessage(data, rowResponseType);
          if (!message.matchedType || message.row == null) {
            return;
          }
          emitter.push(message.row);
          if (message.row.k === ROW_DONE || message.row.k === ROW_ERROR) {
            streamSettled = true;
            cleanup();
          }
        },
      });

      emitter.result.then(
        (value) => {
          if (rootSettled) return;
          rootSettled = true;
          resolve(value);
        },
        (error) => {
          if (rootSettled) return;
          rootSettled = true;
          cleanup();
          reject(error);
        },
      );

      if (timeoutMs > 0) {
        timer = setTimeout(watchTimeout, timeoutMs);
      }

      endpoint.postMessage(createWorkerRequestEnvelope(requestType, id, request));
    });
  }

  return {
    ...baseTransport,
    fetchRSCDirect<T>(input: FetchRSCInput, clientOptions?: FlightClientOptions): Promise<T> {
      const headers = new Headers(input.headers);
      headers.set("accept", "text/x-component");
      return sendRowRequest<T>(
        {
          operation: "fetch",
          endpoint: input.url,
          headers: toHeaderTuples(headers),
          requestInit: input.requestInit,
          componentId: input.componentId,
          componentProps: input.componentProps,
        },
        clientOptions,
      );
    },
    sendActionDirect<T>(input: SendActionInput, clientOptions?: FlightClientOptions): Promise<T> {
      const invalidateRSC = getInvalidateRSC();
      return sendRowRequest<T>(
        {
          operation: "action",
          endpoint: input.endpoint,
          actionId: input.actionId,
          contentType: input.contentType,
          headers: toHeaderTuples(input.headers),
          body: input.body,
          requestInit: input.requestInit,
        },
        clientOptions,
      ).finally(() => invalidateRSC());
    },
  };
}

export type WorkerTransportRequestHandler = (
  request: WorkerTransportRequestMessage,
) => Promise<Response> | Response;

function postMessageWithTransfer(
  target: { postMessage: (message: unknown, transfer?: Transferable[]) => void },
  message: unknown,
  transfer?: Transferable[],
): void {
  if (transfer != null && transfer.length > 0) {
    try {
      target.postMessage(message, transfer);
      return;
    } catch {
      // Some endpoints may not accept transfer lists in this environment.
    }
  }

  target.postMessage(message);
}

function resolveReplyTarget(
  event: MessageEvent<unknown>,
): { postMessage: (message: unknown, transfer?: Transferable[]) => void } | null {
  const currentTarget = event.currentTarget as {
    postMessage?: (message: unknown, transfer?: Transferable[]) => void;
  } | null;
  if (currentTarget?.postMessage) {
    const target = currentTarget as {
      postMessage: (message: unknown, transfer?: Transferable[]) => void;
    };
    return {
      postMessage: (message, transfer) => postMessageWithTransfer(target, message, transfer),
    };
  }

  const globalTarget = globalThis as unknown as {
    postMessage?: (message: unknown, transfer?: Transferable[]) => void;
  };
  if (typeof globalTarget.postMessage === "function") {
    const target = globalTarget as {
      postMessage: (message: unknown, transfer?: Transferable[]) => void;
    };
    return {
      postMessage: (message, transfer) => postMessageWithTransfer(target, message, transfer),
    };
  }

  return null;
}

export function createWorkerTransportMessageHandler(
  handler: WorkerTransportRequestHandler,
  options: WorkerTransportOptions = {},
): MessageEventListener {
  const requestType = options.requestType ?? DEFAULT_REQUEST_TYPE;
  const responseType = options.responseType ?? DEFAULT_RESPONSE_TYPE;
  const responseTypeMap = createWorkerResponseTypeMap(responseType);

  return async (event: MessageEvent<unknown>) => {
    const request = normalizeIncomingWorkerTransportRequest(event.data, requestType);
    if (request == null) return;

    const replyTarget = resolveReplyTarget(event);
    if (replyTarget == null) return;

    try {
      const response = await handler(request);
      replyTarget.postMessage({
        type: responseTypeMap.head,
        id: request.id,
        status: response.status,
        headers: [...response.headers.entries()],
      } satisfies WorkerTransportResponseHeadMessage);

      if (response.body != null) {
        const reader = response.body.getReader();
        try {
          const chunkBatch: Uint8Array[] = [];
          let batchBytes = 0;
          const flushBatch = (): void => {
            if (chunkBatch.length === 0) {
              return;
            }
            const chunk = concatUint8Chunks(chunkBatch, batchBytes);
            const transfer = transferListForChunk(chunk);
            replyTarget.postMessage(
              {
                type: responseTypeMap.next,
                id: request.id,
                chunk,
              } satisfies WorkerTransportResponseNextMessage,
              transfer,
            );
            chunkBatch.length = 0;
            batchBytes = 0;
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              flushBatch();
              break;
            }
            chunkBatch.push(value);
            batchBytes += value.byteLength;
            if (batchBytes >= WORKER_STREAM_CHUNK_BATCH_BYTES) {
              flushBatch();
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      replyTarget.postMessage({
        type: responseTypeMap.done,
        id: request.id,
      } satisfies WorkerTransportResponseDoneMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      replyTarget.postMessage({
        type: responseTypeMap.error,
        id: request.id,
        error: message,
      } satisfies WorkerTransportResponseErrorMessage);
    }
  };
}

export type WorkerRowTransportRequestHandler = (
  request: WorkerTransportRequestMessage,
  emit: (row: FlightRowMessage, transfer?: Transferable[]) => void,
) => Promise<void> | void;

export function createWorkerRowTransportMessageHandler(
  handler: WorkerRowTransportRequestHandler,
  options: WorkerTransportOptions = {},
): MessageEventListener {
  const requestType = options.requestType ?? DEFAULT_REQUEST_TYPE;
  const rowResponseType = options.responseType ?? DEFAULT_ROW_RESPONSE_TYPE;

  return async (event: MessageEvent<unknown>) => {
    const request = normalizeIncomingWorkerTransportRequest(event.data, requestType);
    if (request == null) return;

    const replyTarget = resolveReplyTarget(event);
    if (replyTarget == null) return;

    const emit = (row: FlightRowMessage, transfer?: Transferable[]): void => {
      const message: WorkerRowResponseMessage = {
        type: rowResponseType,
        id: request.id,
        row,
      };
      replyTarget.postMessage(message, transfer);
    };

    try {
      await handler(request, emit);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit(flightErrorRow(message));
    }
  };
}
