export interface SendActionInput {
  endpoint: string;
  actionId: string;
  body: BodyInit;
  contentType: string;
  headers?: HeadersInit;
  requestInit?: Omit<RequestInit, "method" | "body" | "headers">;
}

export interface FetchRSCInput {
  url: string;
  headers?: HeadersInit;
  requestInit?: Omit<RequestInit, "headers">;
}

export interface RSCTransport {
  sendAction(input: SendActionInput): Promise<Response>;
  fetchRSC?(input: FetchRSCInput): Promise<Response>;
}

export function createFetchTransport(): RSCTransport {
  return {
    async sendAction(input): Promise<Response> {
      return fetch(input.endpoint, {
        method: "POST",
        body: input.body,
        headers: {
          "Content-Type": input.contentType,
          "x-rsc-action": input.actionId,
          ...input.headers,
        },
        ...input.requestInit,
      });
    },

    async fetchRSC(input): Promise<Response> {
      return fetch(input.url, {
        headers: {
          Accept: "text/x-component",
          ...input.headers,
        },
        ...input.requestInit,
      });
    },
  };
}

export interface FunctionTransportRequest {
  method: "GET" | "POST";
  url: string;
  headers: Headers;
  body: string;
  requestInit?: RequestInit;
}

export type FunctionTransportHandler = (request: FunctionTransportRequest) => Response | Promise<Response>;

function normalizeBody(body: BodyInit): string {
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof FormData) {
    return new URLSearchParams(body as unknown as Record<string, string>).toString();
  }
  if (body instanceof ArrayBuffer) {
    return new TextDecoder().decode(body);
  }
  if (ArrayBuffer.isView(body)) {
    return new TextDecoder().decode(body);
  }
  throw new Error("Unsupported BodyInit for this transport. Use string, URLSearchParams, or typed array.");
}

export function createFunctionTransport(handler: FunctionTransportHandler): RSCTransport {
  return {
    async sendAction(input): Promise<Response> {
      const headers = new Headers(input.headers);
      headers.set("content-type", input.contentType);
      headers.set("x-rsc-action", input.actionId);
      return handler({
        method: "POST",
        url: input.endpoint,
        headers,
        body: normalizeBody(input.body),
        requestInit: input.requestInit,
      });
    },

    async fetchRSC(input): Promise<Response> {
      const headers = new Headers(input.headers);
      headers.set("accept", "text/x-component");
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
  postMessage(message: unknown): void;
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
  body?: string;
  requestInit?: Omit<RequestInit, "method" | "body" | "headers">;
}

export interface WorkerTransportResponseMessage {
  type: string;
  id: string;
  status: number;
  headers?: [string, string][];
  body?: string;
  error?: string;
}

export interface WorkerTransportOptions {
  requestType?: string;
  responseType?: string;
  timeoutMs?: number;
}

const DEFAULT_REQUEST_TYPE = "rsc.transport.request";
const DEFAULT_RESPONSE_TYPE = "rsc.transport.response";

let requestCounter = 0;

function nextRequestId(): string {
  requestCounter += 1;
  return `rsc-${Date.now()}-${requestCounter}`;
}

function toHeaderTuples(headers?: HeadersInit): [string, string][] {
  return [...new Headers(headers).entries()];
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

  return new Promise<Response>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      endpoint.removeEventListener("message", onMessage);
      if (timer != null) clearTimeout(timer);
    };

    const onMessage: MessageEventListener = (event) => {
      const data = event.data as WorkerTransportResponseMessage;
      if (data == null || data.type !== responseType || data.id !== id) return;
      cleanup();
      if (data.error) {
        reject(new Error(data.error));
        return;
      }
      resolve(new Response(data.body ?? null, { status: data.status, headers: data.headers }));
    };

    endpoint.addEventListener("message", onMessage);

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Worker transport timed out after ${timeoutMs}ms`));
      }, timeoutMs);
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
          body: normalizeBody(input.body),
          requestInit: input.requestInit,
        },
        options,
      );
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
        },
        options,
      );
    },
  };
}

export type WorkerTransportRequestHandler = (
  request: WorkerTransportRequestMessage,
) => Promise<Response> | Response;

function resolveReplyTarget(event: MessageEvent<unknown>): { postMessage: (message: unknown) => void } | null {
  const currentTarget = event.currentTarget as { postMessage?: (message: unknown) => void } | null;
  if (currentTarget?.postMessage) {
    return { postMessage: (message) => currentTarget.postMessage?.(message) };
  }

  const globalTarget = globalThis as unknown as { postMessage?: (message: unknown) => void };
  if (typeof globalTarget.postMessage === "function") {
    return { postMessage: globalTarget.postMessage.bind(globalTarget) };
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
      const body = await response.text();
      replyTarget.postMessage({
        type: responseType,
        id: request.id,
        status: response.status,
        headers: [...response.headers.entries()],
        body,
      } satisfies WorkerTransportResponseMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      replyTarget.postMessage({
        type: responseType,
        id: request.id,
        status: 500,
        headers: [["content-type", "application/json"]],
        error: message,
      } satisfies WorkerTransportResponseMessage);
    }
  };
}
