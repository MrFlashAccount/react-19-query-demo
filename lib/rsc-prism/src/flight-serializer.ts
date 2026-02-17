/**
 * Flight serializer helpers backed by the internal runtime.
 */

import { resolveClientManifestOrThrow } from "./runtime/client-manifest";

import type { ReactNode } from "react";
import { registerServerReference, renderToReadableStream } from "./flight-runtime/server";
import { annotateServerReference as annotateRuntimeServerReference } from "./flight-runtime/references";
import { polyfillReady } from "./polyfill";
import type { ClientManifest } from "./types";

const DEFAULT_SERVER_ACTION_REGISTRY_LIMIT = 1024;

type ServerActionFn = (...args: unknown[]) => unknown;
const serverActions = new Map<string, ServerActionFn>();
let serverActionRegistryLimit = DEFAULT_SERVER_ACTION_REGISTRY_LIMIT;

function annotateServerReference<T extends (...args: any[]) => any>(id: string, fn: T): T {
  return annotateRuntimeServerReference(fn, id);
}

function normalizeHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("Content-Type", "text/x-component; charset=utf-8");
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

function looksLikeClientManifest(value: unknown): value is ClientManifest {
  return typeof value === "string";
}

async function renderFlight(
  element: ReactNode,
  manifest?: ClientManifest,
): Promise<ReadableStream<Uint8Array>> {
  await polyfillReady;
  const resolvedManifest = resolveClientManifestOrThrow(manifest);

  return renderToReadableStream(element, resolvedManifest, {
    onError: () => "An error occurred during server rendering.",
  });
}

async function streamToString(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<string> {
  if (!Number.isFinite(maxBytes)) {
    return new Response(stream).text();
  }

  if (maxBytes < 0) {
    throw new Error("maxBytes must be greater than or equal to 0");
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new Error(`Flight payload exceeded maxBytes (${maxBytes})`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function setServerAction(id: string, fn: ServerActionFn): void {
  if (serverActions.has(id)) {
    serverActions.delete(id);
    serverActions.set(id, fn);
    return;
  }

  while (serverActions.size >= serverActionRegistryLimit) {
    const oldest = serverActions.keys().next().value;
    if (oldest == null) break;
    serverActions.delete(oldest);
  }

  serverActions.set(id, fn);
}

export function configureServerActionRegistry(options?: { maxEntries?: number }): void {
  const maxEntries = options?.maxEntries ?? DEFAULT_SERVER_ACTION_REGISTRY_LIMIT;
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error("maxEntries must be a positive integer");
  }

  serverActionRegistryLimit = maxEntries;

  while (serverActions.size > serverActionRegistryLimit) {
    const oldest = serverActions.keys().next().value;
    if (oldest == null) break;
    serverActions.delete(oldest);
  }
}

export function clearServerActionRegistry(): void {
  serverActions.clear();
}

/**
 * Create a server action reference that can be passed to client components.
 */
export function createServerAction<T extends (...args: any[]) => any>(id: string, fn: T): T {
  const annotated = annotateServerReference(id, fn);
  try {
    const registered = registerServerReference(annotated, id, id);
    setServerAction(id, registered as unknown as ServerActionFn);
    return registered;
  } catch {
    setServerAction(id, annotated as unknown as ServerActionFn);
    return annotated;
  }
}

/**
 * Get a registered server action by ID.
 */
export function getServerAction(id: string): ((...args: unknown[]) => unknown) | undefined {
  return serverActions.get(id);
}

/**
 * Execute a server action and return the result serialized as RSC.
 */
export async function executeServerAction(
  actionId: string,
  args: unknown[],
  manifest?: ClientManifest,
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

/**
 * Serialize a React element to the Flight payload string.
 */
export async function serializeToFlightPayload(
  element: ReactNode,
  manifest: ClientManifest,
  options?: {
    maxBytes?: number;
  },
): Promise<string>;
export async function serializeToFlightPayload(
  element: ReactNode,
  options?: {
    maxBytes?: number;
  },
): Promise<string>;
export async function serializeToFlightPayload(
  element: ReactNode,
  manifestOrOptions?:
    | ClientManifest
    | {
        maxBytes?: number;
      },
  maybeOptions?: {
    maxBytes?: number;
  },
): Promise<string> {
  const manifest = looksLikeClientManifest(manifestOrOptions) ? manifestOrOptions : undefined;
  const options = looksLikeClientManifest(manifestOrOptions) ? maybeOptions : manifestOrOptions;
  const stream = await renderFlight(element, manifest);
  return streamToString(stream, options?.maxBytes ?? Number.POSITIVE_INFINITY);
}

/**
 * Serialize a React element to a Flight stream.
 */
export async function serializeToFlightStream(
  element: ReactNode,
  manifest?: ClientManifest,
): Promise<ReadableStream<Uint8Array>> {
  return renderFlight(element, manifest);
}

/**
 * Create a Response from a Flight stream.
 */
export async function createFlightResponse(
  element: ReactNode,
  manifest: ClientManifest,
  init?: ResponseInit,
): Promise<Response>;
export async function createFlightResponse(element: ReactNode, init?: ResponseInit): Promise<Response>;
export async function createFlightResponse(
  element: ReactNode,
  manifestOrInit?: ClientManifest | ResponseInit,
  maybeInit?: ResponseInit,
): Promise<Response> {
  const manifest = looksLikeClientManifest(manifestOrInit) ? manifestOrInit : undefined;
  const init = looksLikeClientManifest(manifestOrInit) ? maybeInit : manifestOrInit;
  const stream = await renderFlight(element, manifest);

  return new Response(stream, {
    ...init,
    headers: normalizeHeaders(init?.headers),
  });
}
