/**
 * RSC HTTP Route Helpers
 *
 * Extends the http module with RSC-specific route definitions.
 */

import type { ReactNode } from "react";
import type { RouteDefinition, RouteParams, RequestContext } from "../types";
import { createRSCHandler, type CreateRSCHandlerOptions } from "./response";
import type { RSCContext, RSCResponseOptions } from "./types";

/**
 * RSC route handler context
 */
export interface RSCRouteContext<TParams extends RouteParams = RouteParams>
  extends RequestContext<TParams> {
  /** RSC context with manifest and actions */
  rsc: RSCContext;
}

/**
 * RSC render handler - returns a React element
 */
export type RSCRenderHandler<TParams extends RouteParams = RouteParams> = (
  ctx: RSCRouteContext<TParams>,
) => ReactNode | Promise<ReactNode>;

/**
 * Create an RSC GET route
 *
 * @example
 * ```ts
 * const handler = createRSCHandler({ manifest, actions });
 *
 * setupWorker([
 *   rscGet('/rsc', handler, () => <App />),
 *   rscGet('/rsc/user/:id', handler, ({ params }) => <UserPage id={params.id} />),
 * ]);
 * ```
 */
export function rscGet<TParams extends RouteParams = RouteParams>(
  path: string,
  handler: ReturnType<typeof createRSCHandler>,
  render: RSCRenderHandler<TParams>,
  options?: RSCResponseOptions,
): RouteDefinition<TParams> {
  return {
    method: "GET",
    path,
    handler: async (ctx) => {
      await handler.ready;
      const element = await render({ ...ctx, rsc: handler.ctx });
      return handler.render(element, options);
    },
  };
}

/**
 * Create an RSC POST route (for actions)
 *
 * @example
 * ```ts
 * const handler = createRSCHandler({ manifest, actions });
 *
 * setupWorker([
 *   rscPost('/rsc/action', handler),
 * ]);
 * ```
 */
export function rscPost<TParams extends RouteParams = RouteParams>(
  path: string,
  handler: ReturnType<typeof createRSCHandler>,
  options?: RSCResponseOptions,
): RouteDefinition<TParams> {
  return {
    method: "POST",
    path,
    handler: async (ctx) => {
      await handler.ready;
      return handler.action(ctx.request, options);
    },
  };
}

/**
 * Create both RSC render and action routes at once
 *
 * @example
 * ```ts
 * const handler = createRSCHandler({ manifest, actions });
 *
 * setupWorker([
 *   ...rscRoutes('/rsc', handler, () => <App />),
 * ]);
 * // Creates:
 * //   GET /rsc - renders the app
 * //   POST /rsc - handles actions
 * ```
 */
export function rscRoutes<TParams extends RouteParams = RouteParams>(
  basePath: string,
  handler: ReturnType<typeof createRSCHandler>,
  render: RSCRenderHandler<TParams>,
  options?: RSCResponseOptions,
): RouteDefinition<TParams>[] {
  return [
    rscGet(basePath, handler, render, options),
    rscPost(basePath, handler, options),
  ];
}

/**
 * Create a full RSC setup with routes
 *
 * @example
 * ```ts
 * const { routes, handler } = createRSCRoutes({
 *   path: '/rsc',
 *   manifest,
 *   actions: { incrementCount },
 *   render: () => <App />,
 * });
 *
 * setupWorker(routes);
 * ```
 */
export function createRSCRoutes<TParams extends RouteParams = RouteParams>(config: {
  /** Base path for RSC routes */
  path: string;
  /** Render function */
  render: RSCRenderHandler<TParams>;
  /** RSC handler options */
  options: CreateRSCHandlerOptions;
  /** Response options */
  responseOptions?: RSCResponseOptions;
}): {
  routes: RouteDefinition<TParams>[];
  handler: ReturnType<typeof createRSCHandler>;
} {
  const handler = createRSCHandler(config.options);

  return {
    routes: rscRoutes(config.path, handler, config.render, config.responseOptions),
    handler,
  };
}

// Re-export for convenience
export { createRSCHandler } from "./response";
export type { CreateRSCHandlerOptions } from "./response";

