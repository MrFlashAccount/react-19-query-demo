/// <reference lib="webworker" />

// URLPattern API types (standard web API, available in service workers)
// https://developer.mozilla.org/en-US/docs/Web/API/URLPattern
declare global {
  interface URLPatternInit {
    protocol?: string;
    username?: string;
    password?: string;
    hostname?: string;
    port?: string;
    pathname?: string;
    search?: string;
    hash?: string;
    baseURL?: string;
  }

  interface URLPatternComponentResult {
    input: string;
    groups: Record<string, string | undefined>;
  }

  interface URLPatternResult {
    inputs: [URLPatternInit] | [URLPatternInit, string];
    protocol: URLPatternComponentResult;
    username: URLPatternComponentResult;
    password: URLPatternComponentResult;
    hostname: URLPatternComponentResult;
    port: URLPatternComponentResult;
    pathname: URLPatternComponentResult;
    search: URLPatternComponentResult;
    hash: URLPatternComponentResult;
  }

  class URLPattern {
    constructor(init?: URLPatternInit, baseURL?: string);
    constructor(pattern: string, baseURL?: string);

    test(input?: URLPatternInit | string, baseURL?: string): boolean;
    exec(input?: URLPatternInit | string, baseURL?: string): URLPatternResult | null;

    readonly protocol: string;
    readonly username: string;
    readonly password: string;
    readonly hostname: string;
    readonly port: string;
    readonly pathname: string;
    readonly search: string;
    readonly hash: string;
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface RouteParams {
  [key: string]: string;
}

export interface RequestContext<TParams extends RouteParams = RouteParams> {
  request: Request;
  url: URL;
  params: TParams;
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
  pattern: URLPattern;
  handler: RequestHandler<TParams>;
}
