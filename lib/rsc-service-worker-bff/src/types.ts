/// <reference lib="webworker" />

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface RouteParams {
  [key: string]: string;
}

export interface RequestContext<TParams extends RouteParams = RouteParams> {
  request: Request;
  url: URL;
  params: TParams;
}

export interface URLPatternMatchResult {
  pathname: {
    groups: Record<string, string | undefined>;
  };
}

export interface URLPatternLike {
  exec(input?: { pathname?: string } | string, baseURL?: string): URLPatternMatchResult | null;
}

export type RequestHandler<TParams extends RouteParams = RouteParams> = (
  ctx: RequestContext<TParams>,
) => Response | Promise<Response>;

export interface RouteDefinition<TParams extends RouteParams = RouteParams> {
  method: HttpMethod;
  path: string;
  handler: RequestHandler<TParams>;
}

export interface ServiceWorkerOptions {
  /** Base path to match routes against. Default: "" */
  basePath?: string;
  /** Called when no route matches. Default: passthrough to network */
  fallback?: (request: Request) => Response | Promise<Response>;
}

export interface ServiceWorker {
  /** Start intercepting requests */
  start(): Promise<ServiceWorkerRegistration>;
  /** Stop intercepting requests */
  stop(): Promise<void>;
}

/** Internal: compiled route with URLPattern */
export interface CompiledRoute<TParams extends RouteParams = RouteParams> {
  method: HttpMethod;
  pattern: URLPatternLike;
  handler: RequestHandler<TParams>;
}
