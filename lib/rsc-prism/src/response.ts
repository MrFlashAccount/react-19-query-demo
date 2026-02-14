/**
 * RSC Response Helpers
 *
 * Provides response builders for RSC streams in service workers.
 */

import type { ReactNode } from "react";
import { polyfillReady } from "./polyfill";
import {
  renderRSC,
  handleAction,
  getActionIdFromRequest,
  createRSCContext,
  registerActions,
  registerActionModule,
} from "./server";
import type { ClientManifest, EncodedActionArgs, RSCResponseOptions, RSCContext } from "./types";

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
  const stream = await renderRSC(element, ctx, { onError: options?.onError });

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

  const stream = await renderRSC(element, ctx, { onError: options?.onError });

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
    return new Response(JSON.stringify({ error: "Missing action ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse encoded args from request body without forcing text round-trips for form payloads.
  const contentType = request.headers.get("Content-Type") ?? "";
  const encodedArgs: EncodedActionArgs = contentType.includes("form")
    ? { type: "formdata", data: await request.formData() }
    : { type: "string", data: await request.text() };

  try {
    const stream = await handleAction(ctx, actionId, encodedArgs, { onError: options?.onError });

    return new Response(stream, {
      status: options?.status ?? 200,
      headers: createRSCHeaders(options?.headers),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[rsc-sw-bff] Action error:", err);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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
  action: (request: Request, responseOptions?: RSCResponseOptions) => Promise<Response>;
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

    async action(request: Request, responseOptions?: RSCResponseOptions): Promise<Response> {
      await ready;
      return rscAction(request, ctx, {
        onError: options.onError,
        ...responseOptions,
      });
    },

    ready,
  };
}

// Re-export for convenience
export { createRSCContext, registerActions } from "./server";
export type { RSCContext, RSCResponseOptions, ClientManifest };
