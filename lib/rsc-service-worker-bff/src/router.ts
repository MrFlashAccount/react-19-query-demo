/// <reference lib="webworker" />
import type { CompiledRoute, RouteDefinition, RouteParams, URLPatternLike } from "./types";

// Ensure URLPattern global types are available
import "./types";

/**
 * Compile a route definition into a matchable route using URLPattern
 */
export function compileRoute<TParams extends RouteParams>(
  route: RouteDefinition<TParams>,
): CompiledRoute<TParams> {
  // URLPattern uses :param syntax natively.
  const URLPatternCtor = (globalThis as unknown as { URLPattern: unknown }).URLPattern as {
    new (init?: { pathname?: string } | string, baseURL?: string): URLPatternLike;
  };
  const pattern = new URLPatternCtor({ pathname: route.path });

  return {
    method: route.method,
    pattern,
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

    const match = route.pattern.exec({ pathname });
    if (match) {
      // Extract params from URLPattern result
      const params: RouteParams = {};
      const groups = match.pathname.groups;
      for (const [key, value] of Object.entries(groups)) {
        if (value !== undefined) {
          params[key] = decodeURIComponent(value);
        }
      }
      return { route, params };
    }
  }

  return null;
}
