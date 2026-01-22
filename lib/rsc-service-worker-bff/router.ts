import type { CompiledRoute, RouteDefinition, RouteParams } from "./types";

/**
 * Convert a path pattern like "/api/movies/:id/rating" to a regex
 * and extract parameter names
 */
export function compilePath(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];

  // Escape special regex chars except : for params
  const regexPattern = path
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, paramName) => {
      paramNames.push(paramName);
      return "([^/]+)";
    });

  return {
    pattern: new RegExp(`^${regexPattern}$`),
    paramNames,
  };
}

/**
 * Compile a route definition into a matchable route
 */
export function compileRoute<TParams extends RouteParams>(
  route: RouteDefinition<TParams>,
): CompiledRoute<TParams> {
  const { pattern, paramNames } = compilePath(route.path);
  return {
    method: route.method,
    pattern,
    paramNames,
    handler: route.handler,
  };
}

/**
 * Match a request against compiled routes
 */
export function matchRoute(
  pathname: string,
  method: string,
  routes: CompiledRoute[],
): { route: CompiledRoute; params: RouteParams } | null {
  for (const route of routes) {
    if (route.method !== method) continue;

    const match = pathname.match(route.pattern);
    if (match) {
      const params: RouteParams = {};
      route.paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(match[index + 1]);
      });
      return { route, params };
    }
  }

  return null;
}

