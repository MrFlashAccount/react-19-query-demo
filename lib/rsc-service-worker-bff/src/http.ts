import type { HttpMethod, RequestHandler, RouteDefinition, RouteParams } from "./types";

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
} as const;
