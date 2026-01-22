import type { ReactNode } from "react";
import type { HttpMethod, RequestHandler, RouteDefinition, RouteParams } from "./types";
import type { RSCContext } from "./rsc/types";
import { json } from "./response";

/**
 * Create a route definition for a given HTTP method
 */
function createRouteFactory(method: HttpMethod) {
  return function <TParams extends RouteParams = RouteParams>(
    path: string,
    handler: RequestHandler<TParams>,
  ): RouteDefinition<TParams> {
    return { method, path, handler };
  };
}

/**
 * RSC Response headers
 */
const RSC_HEADERS = {
  "Content-Type": "text/x-component; charset=utf-8",
  "Cache-Control": "no-cache, no-store, must-revalidate",
} as const;

/**
 * Options for RSC route handlers
 */
export interface RSCRouteOptions {
  /** Promise that resolves when initialization is complete */
  ready?: Promise<void>;
  /** Custom headers to merge with RSC defaults */
  headers?: HeadersInit;
}

/**
 * HTTP method helpers for defining routes
 *
 * @example
 * ```ts
 * http.get('/api/users', ({ url }) => {
 *   return json([{ id: 1, name: 'John' }])
 * })
 *
 * http.post('/api/users', async ({ request }) => {
 *   const body = await request.json()
 *   return json({ id: 2, ...body }, { status: 201 })
 * })
 *
 * http.get('/api/users/:id', ({ params }) => {
 *   return json({ id: params.id, name: 'John' })
 * })
 * ```
 */
export const http = {
  get: createRouteFactory("GET"),
  post: createRouteFactory("POST"),
  put: createRouteFactory("PUT"),
  patch: createRouteFactory("PATCH"),
  delete: createRouteFactory("DELETE"),
  head: createRouteFactory("HEAD"),
  options: createRouteFactory("OPTIONS"),

  /**
   * Create a route that matches any HTTP method
   */
  all<TParams extends RouteParams = RouteParams>(
    path: string,
    handler: RequestHandler<TParams>,
  ): RouteDefinition<TParams>[] {
    const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
    return methods.map((method) => ({ method, path, handler }));
  },

  /**
   * Create an RSC GET route that renders a React component
   *
   * @example
   * ```tsx
   * http.rsc("/rsc", () => <App />, ctx, { ready: initPromise })
   * ```
   */
  rsc(
    path: string,
    render: () => ReactNode,
    ctx: RSCContext,
    options?: RSCRouteOptions,
  ): RouteDefinition {
    return {
      method: "GET",
      path,
      handler: async () => {
        // Lazy import to avoid circular deps and ensure webpack-shim loads first
        const { renderRSC } = await import("./rsc/server");

        if (options?.ready) {
          await options.ready;
        }

        const stream = await renderRSC(render(), ctx);

        return new Response(stream, {
          headers: {
            ...RSC_HEADERS,
            ...options?.headers,
          },
        });
      },
    };
  },

  /**
   * Create an RSC POST route that handles server actions
   *
   * @example
   * ```tsx
   * http.action("/rsc", ctx, { ready: initPromise })
   * ```
   */
  action(path: string, ctx: RSCContext, options?: RSCRouteOptions): RouteDefinition {
    return {
      method: "POST",
      path,
      handler: async ({ request }) => {
        // Lazy import to avoid circular deps and ensure webpack-shim loads first
        const { handleAction, isActionRequest, getActionIdFromRequest } =
          await import("./rsc/server");

        if (options?.ready) {
          await options.ready;
        }

        if (!isActionRequest(request)) {
          return json({ error: "Missing action header (x-rsc-action)" }, { status: 400 });
        }

        const actionId = getActionIdFromRequest(request)!;

        // Parse args from request body
        const body = await request.text();
        let args: unknown[] = [];
        try {
          args = JSON.parse(body);
          if (!Array.isArray(args)) args = [args];
        } catch {
          args = body ? [body] : [];
        }

        // Create encoded format for handleAction
        const encodedArgs = { type: "string" as const, data: JSON.stringify(args) };

        try {
          const stream = await handleAction(ctx, actionId, encodedArgs);
          return new Response(stream, {
            headers: {
              ...RSC_HEADERS,
              ...options?.headers,
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[rsc-sw-bff] Action error:", message);
          return json({ error: message }, { status: 500 });
        }
      },
    };
  },

  /**
   * Create both RSC GET and action POST routes at the same path
   *
   * @example
   * ```tsx
   * // Creates both GET /rsc (render) and POST /rsc (actions)
   * ...http.rscRoutes("/rsc", () => <App />, ctx, { ready: initPromise })
   * ```
   */
  rscRoutes(
    path: string,
    render: () => ReactNode,
    ctx: RSCContext,
    options?: RSCRouteOptions,
  ): [RouteDefinition, RouteDefinition] {
    return [this.rsc(path, render, ctx, options), this.action(path, ctx, options)];
  },
} as const;
