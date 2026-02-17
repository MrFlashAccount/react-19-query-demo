import { invalidateRSC } from "./react";

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
}

export function createFetchTransport(): RSCTransport {
  return {
    async sendAction(input): Promise<Response> {
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

export interface WorkerTransportOptions {
  requestType?: string;
  responseType?: string;
  timeoutMs?: number;
}

const DEFAULT_REQUEST_TYPE = "rsc.transport.request";
const DEFAULT_RESPONSE_TYPE = "rsc.transport.response";

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

type WorkerResponseMessage =
  | WorkerTransportResponseHeadMessage
  | WorkerTransportResponseNextMessage
  | WorkerTransportResponseDoneMessage
  | WorkerTransportResponseErrorMessage;

interface PendingWorkerRequest {
  touchActivity: () => void;
  handleMessage: (message: WorkerResponseMessage) => void;
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
    const message = event.data as WorkerResponseMessage | null;
    if (message == null || typeof message.id !== "string" || typeof message.type !== "string") {
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
        if (data.type === responseHeadType(responseType)) {
          const head = data as WorkerTransportResponseHeadMessage;
          if (didResolveHead || isSettled) return;

          didResolveHead = true;
          isSettled = true;
          resolve(
            new Response(stream, {
              status: head.status,
              headers: head.headers,
            }),
          );
          return;
        }

        if (data.type === responseNextType(responseType)) {
          if (!didResolveHead || streamDone) return;
          const next = data as WorkerTransportResponseNextMessage;
          if (streamController != null) {
            streamController.enqueue(next.chunk);
          } else {
            pendingChunks.push(next.chunk);
          }
          return;
        }

        if (data.type === responseDoneType(responseType)) {
          if (!didResolveHead || streamDone) return;
          cleanup();
          closeStream();
          return;
        }

        if (data.type === responseErrorType(responseType)) {
          const error = new Error((data as WorkerTransportResponseErrorMessage).error);
          cleanup();
          if (!didResolveHead && !isSettled) {
            isSettled = true;
            reject(error);
          } else {
            failStream(error);
          }
        }
      },
    });

    if (timeoutMs > 0) {
      timer = setTimeout(watchTimeout, timeoutMs);
    }

    endpoint.postMessage({
      ...request,
      id,
      type: requestType,
    } satisfies WorkerTransportRequestMessage);
  });
}

export function createWorkerTransport(
  endpoint: WorkerMessageEndpoint,
  options: WorkerTransportOptions = {},
): RSCTransport {
  return {
    async sendAction(input): Promise<Response> {
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
      ).finally(invalidateRSC);
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

  return async (event: MessageEvent<unknown>) => {
    const request = event.data as WorkerTransportRequestMessage;
    if (request == null || request.type !== requestType || request.id == null) return;

    const replyTarget = resolveReplyTarget(event);
    if (replyTarget == null) return;

    try {
      const response = await handler(request);
      replyTarget.postMessage({
        type: responseHeadType(responseType),
        id: request.id,
        status: response.status,
        headers: [...response.headers.entries()],
      } satisfies WorkerTransportResponseHeadMessage);

      if (response.body != null) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const transfer = transferListForChunk(value);
            replyTarget.postMessage(
              {
                type: responseNextType(responseType),
                id: request.id,
                chunk: value,
              } satisfies WorkerTransportResponseNextMessage,
              transfer,
            );
          }
        } finally {
          reader.releaseLock();
        }
      }

      replyTarget.postMessage({
        type: responseDoneType(responseType),
        id: request.id,
      } satisfies WorkerTransportResponseDoneMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      replyTarget.postMessage({
        type: responseErrorType(responseType),
        id: request.id,
        error: message,
      } satisfies WorkerTransportResponseErrorMessage);
    }
  };
}
