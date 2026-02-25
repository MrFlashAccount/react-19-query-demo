/**
 * RSC Response Helpers
 *
 * Provides response builders for RSC streams in service workers.
 */

import type { ReactNode } from "react";
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
import type { RSCTraceContext } from "./types";
import type { FlightRowEmit } from "./flight-runtime/server";
import { flightErrorRow } from "./flight-runtime/wire";
import { createTraceRequestId } from "./runtime-globals";

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

function requestTraceContext(request: Request): RSCTraceContext {
  return {
    requestId: request.headers.get("x-rsc-request-id") ?? createTraceRequestId("response"),
    actionId: getActionIdFromRequest(request) ?? undefined,
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
  const traceContext: RSCTraceContext = {
    requestId: createTraceRequestId("response-render"),
    source: "server",
  };
  const stream = await renderRSC(element, ctx, {
    onError: options?.onError,
    traceContext,
  });

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

  const traceContext: RSCTraceContext = {
    requestId: createTraceRequestId("response-render"),
    source: "server",
  };
  const stream = await renderRSC(element, ctx, {
    onError: options?.onError,
    traceContext,
  });

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

  const encodedArgs = await readEncodedActionArgs(request);

  try {
    const stream = await handleAction(ctx, actionId, encodedArgs, {
      onError: options?.onError,
      traceContext: requestTraceContext(request),
    });

    return new Response(stream, {
      status: options?.status ?? 200,
      headers: createRSCHeaders(options?.headers),
    });
  } catch (err) {
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
    await polyfillReady;
    if (options.actions) {
      await registerActions(ctx, options.actions);
    }
    if (options.actionModules) {
      for (const actionModule of options.actionModules) {
        await registerActionModule(ctx, actionModule.moduleId, actionModule.moduleExports);
      }
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
      await renderRSCRows(element, ctx, emit, {
        onError: options.onError,
        traceContext: {
          requestId: createTraceRequestId("response-rows"),
          source: "server",
        },
      });
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

      const encodedArgs = await readEncodedActionArgs(request);

      try {
        await handleActionRows(ctx, actionId, encodedArgs, emit, {
          onError: options.onError,
          traceContext: requestTraceContext(request),
        });
      } catch (err) {
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
