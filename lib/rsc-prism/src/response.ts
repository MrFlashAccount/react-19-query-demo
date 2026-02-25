/**
 * RSC Response Helpers
 *
 * Provides response builders for RSC streams in service workers.
 */

import type { ReactNode } from "react";
import { polyfillReady } from "./polyfill";
import {
  renderRSCRows,
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

/**
 * RSC content type header
 */
export const RSC_CONTENT_TYPE = "text/x-component";

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
  renderRows: (
    element: ReactNode,
    emit: FlightRowEmit,
    responseOptions?: RSCResponseOptions,
  ) => Promise<void>;
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

    async renderRows(
      element: ReactNode,
      emit: FlightRowEmit,
      _responseOptions?: RSCResponseOptions,
    ): Promise<void> {
      await ready;
      await renderRSCRows(element, ctx, emit, {
        onError: options.onError,
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
      return executeServerAction(ctx, actionId, encodedArgs);
    },

    ready,
  };
}

// Re-export for convenience
export { createRSCContext, registerActions } from "./server";
export type { RSCContext, RSCResponseOptions, ClientManifest };
