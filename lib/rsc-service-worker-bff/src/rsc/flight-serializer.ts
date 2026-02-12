import "./webpack-shim";

import type { ReactNode } from "react";
import { registerServerReference, renderToReadableStream } from "react-server-dom-webpack/server.browser";
import { polyfillReady } from "./polyfill";
import type { ClientManifest } from "./types";

const REACT_SERVER_REFERENCE = Symbol.for("react.server.reference");

type ServerActionFn = (...args: unknown[]) => unknown;
const serverActions = new Map<string, ServerActionFn>();

function annotateServerReference<T extends (...args: any[]) => any>(id: string, fn: T): T {
  const ref = fn as T & {
    $$typeof?: symbol;
    $$id?: string;
    $$bound?: null;
  };
  ref.$$typeof = REACT_SERVER_REFERENCE;
  ref.$$id = id;
  ref.$$bound = null;
  return ref;
}

function normalizeHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("Content-Type", "text/x-component; charset=utf-8");
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

async function renderFlight(element: ReactNode, manifest: ClientManifest): Promise<ReadableStream<Uint8Array>> {
  await polyfillReady;
  return renderToReadableStream(element, manifest, {
    onError: () => "An error occurred during server rendering.",
  });
}

async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }

  output += decoder.decode();
  return output;
}

export function createServerAction<T extends (...args: any[]) => any>(id: string, fn: T): T {
  const annotated = annotateServerReference(id, fn);
  try {
    const registered = registerServerReference(annotated, id, id);
    serverActions.set(id, registered as unknown as ServerActionFn);
    return registered;
  } catch {
    serverActions.set(id, annotated as unknown as ServerActionFn);
    return annotated;
  }
}

export function getServerAction(id: string): ((...args: unknown[]) => unknown) | undefined {
  return serverActions.get(id);
}

export async function executeServerAction(
  actionId: string,
  args: unknown[],
  manifest: ClientManifest,
): Promise<Response> {
  const action = serverActions.get(actionId);
  if (!action) {
    return new Response(JSON.stringify({ error: `Action "${actionId}" not found` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await action(...args);
    return createFlightResponse(result as ReactNode, manifest);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function serializeToFlightPayload(
  element: ReactNode,
  manifest: ClientManifest,
): Promise<string> {
  const stream = await renderFlight(element, manifest);
  return streamToString(stream);
}

export async function serializeToFlightStream(
  element: ReactNode,
  manifest: ClientManifest,
): Promise<ReadableStream<Uint8Array>> {
  return renderFlight(element, manifest);
}

export async function createFlightResponse(
  element: ReactNode,
  manifest: ClientManifest,
  init?: ResponseInit,
): Promise<Response> {
  const stream = await renderFlight(element, manifest);

  return new Response(stream, {
    ...init,
    headers: normalizeHeaders(init?.headers),
  });
}
