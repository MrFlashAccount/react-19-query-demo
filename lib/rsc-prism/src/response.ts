/**
 * RSC Response Helpers
 *
 * Provides response builders for RSC streams in service workers.
 */

import type { ReactNode } from "react";
import type { ISpan } from "@lib/tracing";
import { polyfillReady } from "./polyfill";
import {
  renderRSC,
  renderRSCRows,
  handleAction,
  handleActionRows,
  executeAction as executeServerAction,
  getActionIdFromRequest,
  createRSCContext,
  registerActions,
  registerActionModule,
} from "./server";
import type { ClientManifest, EncodedActionArgs, RSCResponseOptions, RSCContext } from "./types";
import type { FlightRowEmit } from "./flight-runtime/server";
import { flightErrorRow } from "./flight-runtime/wire";
import {
  createTraceRequestId,
  finishTraceSpanError,
  finishTraceSpanSuccess,
  startTraceSpan,
  type RSCTraceContext,
} from "./tracing";

/**
 * RSC content type header
 */
export const RSC_CONTENT_TYPE = "text/x-component";

/**
 * Create headers for an RSC response
 */
function createRSCHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("Content-Type", RSC_CONTENT_TYPE);
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

async function createFlightErrorResponse(
  ctx: RSCContext,
  message: string,
  status: number,
  options?: RSCResponseOptions,
): Promise<Response> {
  const errorRecord = {
    __rscPrismError: true,
    message,
    status,
  } as unknown as ReactNode;
  const stream = await renderRSC(errorRecord, ctx, { onError: options?.onError });
  return new Response(stream, {
    status,
    headers: createRSCHeaders(options?.headers),
  });
}

async function createFlightErrorRows(
  ctx: RSCContext,
  emit: FlightRowEmit,
  message: string,
  options?: RSCResponseOptions,
): Promise<void> {
  const errorRecord = {
    __rscPrismError: true,
    message,
    status: 500,
  } as unknown as ReactNode;
  await renderRSCRows(errorRecord, ctx, emit, { onError: options?.onError });
}

async function readEncodedActionArgs(request: Request): Promise<EncodedActionArgs> {
  const contentType = request.headers.get("Content-Type") ?? "";
  return contentType.includes("form")
    ? { type: "formdata", data: await request.formData() }
    : { type: "string", data: await request.text() };
}

function requestTraceContext(request: Request, parentSpan?: ISpan): RSCTraceContext {
  return {
    requestId: request.headers.get("x-rsc-request-id") ?? createTraceRequestId("response"),
    actionId: getActionIdFromRequest(request) ?? undefined,
    parentSpan,
    source: "server",
  };
}

/**
 * Create an RSC streaming response from a React element
 *
 * @example
 * ```ts
 * http.get('/rsc', () => {
 *   return rsc(<App />, manifest);
 * });
 * ```
 */
export async function rsc(
  element: ReactNode,
  manifest: ClientManifest,
  options?: RSCResponseOptions,
): Promise<Response> {
  await polyfillReady;

  const ctx = createRSCContext(manifest);
  const span = startTraceSpan(
    "rsc.response.render",
    {
      source: "server",
    },
    undefined,
    "secondary",
  );

  const traceContext: RSCTraceContext = {
    requestId: createTraceRequestId("response-render"),
    parentSpan: span,
    source: "server",
  };
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await renderRSC(element, ctx, {
      onError: options?.onError,
      traceContext,
    });
    finishTraceSpanSuccess(span);
  } catch (error) {
    finishTraceSpanError(span, error);
    throw error;
  }

  return new Response(stream, {
    status: options?.status ?? 200,
    headers: createRSCHeaders(options?.headers),
  });
}

/**
 * Create an RSC streaming response using a pre-configured context
 *
 * @example
 * ```ts
 * const ctx = createRSCContext(manifest);
 * await registerActions(ctx, { increment });
 *
 * http.get('/rsc', () => rscWithContext(<App />, ctx));
 * ```
 */
export async function rscWithContext(
  element: ReactNode,
  ctx: RSCContext,
  options?: RSCResponseOptions,
): Promise<Response> {
  await polyfillReady;

  const span = startTraceSpan(
    "rsc.response.renderWithContext",
    {
      source: "server",
    },
    undefined,
    "secondary",
  );
  const traceContext: RSCTraceContext = {
    requestId: createTraceRequestId("response-render"),
    parentSpan: span,
    source: "server",
  };
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await renderRSC(element, ctx, {
      onError: options?.onError,
      traceContext,
    });
    finishTraceSpanSuccess(span);
  } catch (error) {
    finishTraceSpanError(span, error);
    throw error;
  }

  return new Response(stream, {
    status: options?.status ?? 200,
    headers: createRSCHeaders(options?.headers),
  });
}

/**
 * Handle a server action request
 *
 * @example
 * ```ts
 * http.post('/rsc/action', async ({ request }) => {
 *   return rscAction(request, ctx);
 * });
 * ```
 */
export async function rscAction(
  request: Request,
  ctx: RSCContext,
  options?: RSCResponseOptions,
): Promise<Response> {
  await polyfillReady;

  const actionId = getActionIdFromRequest(request);
  if (!actionId) {
    return createFlightErrorResponse(ctx, "Missing action ID", 400, options);
  }

  const actionSpan = startTraceSpan(
    "rsc.response.action",
    {
      requestId: request.headers.get("x-rsc-request-id") ?? undefined,
      actionId,
      source: "server",
    },
    undefined,
    "secondary",
  );
  const encodedArgs = await readEncodedActionArgs(request);

  try {
    const stream = await handleAction(ctx, actionId, encodedArgs, {
      onError: options?.onError,
      traceContext: requestTraceContext(request, actionSpan),
    });
    finishTraceSpanSuccess(actionSpan);

    return new Response(stream, {
      status: options?.status ?? 200,
      headers: createRSCHeaders(options?.headers),
    });
  } catch (err) {
    finishTraceSpanError(actionSpan, err);
    const message = err instanceof Error ? err.message : String(err);
    console.error("[rsc-sw-bff] Action error:", err);
    return createFlightErrorResponse(ctx, message, 500, options);
  }
}

/**
 * Create an RSC error response
 */
export function rscError(message: string, status: number = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Options for creating an RSC handler
 */
export interface CreateRSCHandlerOptions {
  /** Client manifest for resolving client components (optional when worker plugin auto-registers client refs) */
  manifest?: ClientManifest;
  /** Server actions to register */
  actions?: Record<string, (...args: unknown[]) => unknown>;
  /** Worker action modules auto-registered as `${moduleId}#${exportName}` */
  actionModules?: Array<{
    moduleId: string;
    moduleExports: Record<string, unknown>;
  }>;
  /** Error handler */
  onError?: (error: unknown) => string | void;
}

/**
 * Create an RSC render handler with pre-configured context
 *
 * @example
 * ```ts
 * const renderApp = createRSCHandler({
 *   manifest,
 *   actions: { incrementCount },
 * });
 *
 * http.get('/rsc', () => renderApp(<App />));
 * ```
 */
export function createRSCHandler(options: CreateRSCHandlerOptions): {
  ctx: RSCContext;
  render: (element: ReactNode, responseOptions?: RSCResponseOptions) => Promise<Response>;
  renderRows: (
    element: ReactNode,
    emit: FlightRowEmit,
    responseOptions?: RSCResponseOptions,
  ) => Promise<void>;
  action: (request: Request, responseOptions?: RSCResponseOptions) => Promise<Response>;
  actionRows: (
    request: Request,
    emit: FlightRowEmit,
    responseOptions?: RSCResponseOptions,
  ) => Promise<void>;
  executeAction: (request: Request) => Promise<unknown>;
  ready: Promise<void>;
} {
  const ctx = createRSCContext(options.manifest);

  const ready = (async () => {
    const readySpan = startTraceSpan(
      "rsc.response.handler.ready",
      {
        source: "server",
      },
      undefined,
      "secondary",
    );
    try {
      await polyfillReady;
      if (options.actions) {
        await registerActions(ctx, options.actions);
      }
      if (options.actionModules) {
        for (const actionModule of options.actionModules) {
          await registerActionModule(ctx, actionModule.moduleId, actionModule.moduleExports);
        }
      }
      finishTraceSpanSuccess(readySpan);
    } catch (error) {
      finishTraceSpanError(readySpan, error);
      throw error;
    }
  })();

  return {
    ctx,

    async render(element: ReactNode, responseOptions?: RSCResponseOptions): Promise<Response> {
      await ready;
      return rscWithContext(element, ctx, {
        onError: options.onError,
        ...responseOptions,
      });
    },

    async renderRows(
      element: ReactNode,
      emit: FlightRowEmit,
      _responseOptions?: RSCResponseOptions,
    ): Promise<void> {
      await ready;
      const span = startTraceSpan(
        "rsc.response.handler.renderRows",
        {
          source: "server",
        },
        undefined,
        "secondary",
      );
      await renderRSCRows(element, ctx, emit, {
        onError: options.onError,
        traceContext: {
          requestId: createTraceRequestId("response-rows"),
          parentSpan: span,
          source: "server",
        },
      });
      finishTraceSpanSuccess(span);
    },

    async action(request: Request, responseOptions?: RSCResponseOptions): Promise<Response> {
      await ready;
      return rscAction(request, ctx, {
        onError: options.onError,
        ...responseOptions,
      });
    },

    async actionRows(
      request: Request,
      emit: FlightRowEmit,
      _responseOptions?: RSCResponseOptions,
    ): Promise<void> {
      await ready;

      const actionId = getActionIdFromRequest(request);
      if (!actionId) {
        emit(flightErrorRow("Missing action ID"));
        return;
      }
      const actionSpan = startTraceSpan(
        "rsc.response.handler.actionRows",
        {
          requestId: request.headers.get("x-rsc-request-id") ?? undefined,
          actionId,
          source: "server",
        },
        undefined,
        "secondary",
      );

      const encodedArgs = await readEncodedActionArgs(request);

      try {
        await handleActionRows(ctx, actionId, encodedArgs, emit, {
          onError: options.onError,
          traceContext: requestTraceContext(request, actionSpan),
        });
        finishTraceSpanSuccess(actionSpan);
      } catch (err) {
        finishTraceSpanError(actionSpan, err);
        const message = err instanceof Error ? err.message : String(err);
        console.error("[rsc-sw-bff] Action error:", err);
        if (message.length > 0) {
          emit(flightErrorRow(message));
          return;
        }
        await createFlightErrorRows(ctx, emit, "Action failed", {
          onError: options.onError,
        });
      }
    },

    async executeAction(request: Request): Promise<unknown> {
      await ready;
      const actionId = getActionIdFromRequest(request);
      if (!actionId) {
        throw new Error("Missing action ID");
      }
      const encodedArgs = await readEncodedActionArgs(request);
      return executeServerAction(ctx, actionId, encodedArgs, requestTraceContext(request));
    },

    ready,
  };
}

// Re-export for convenience
export { createRSCContext, registerActions } from "./server";
export type { RSCContext, RSCResponseOptions, ClientManifest };
