export interface JsonResponseInit extends Omit<ResponseInit, "headers"> {
  headers?: HeadersInit;
}

/**
 * Create a JSON response
 */
export function json<T>(data: T, init?: JsonResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

/**
 * Create a text response
 */
export function text(body: string, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "text/plain");

  return new Response(body, {
    ...init,
    headers,
  });
}

/**
 * Create an HTML response
 */
export function html(body: string, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "text/html");

  return new Response(body, {
    ...init,
    headers,
  });
}

/**
 * Create a redirect response
 */
export function redirect(url: string, status: 301 | 302 | 303 | 307 | 308 = 302): Response {
  return Response.redirect(url, status);
}

/**
 * Create a no-content response
 */
export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/**
 * Create an error response
 */
export function error(message: string, status: number = 500): Response {
  return json({ error: message }, { status });
}

/**
 * Passthrough to network
 */
export function passthrough(request: Request): Promise<Response> {
  return fetch(request);
}
