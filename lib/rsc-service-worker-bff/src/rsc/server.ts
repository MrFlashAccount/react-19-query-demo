import type { ReactNode } from "react";
import { moduleCache } from "./webpack-shim";
import {
  createClientModuleProxy,
  decodeReply,
  registerServerReference,
  renderToReadableStream,
} from "react-server-dom-webpack/server.browser";
import type { ClientManifest, EncodedActionArgs, RSCContext, RSCRenderOptions } from "./types";

// Keep webpack shim initialization from being tree-shaken in sideEffects:false builds.
void moduleCache;

/**
 * Create an RSC context for rendering
 */
export function createRSCContext(manifest: ClientManifest): RSCContext {
  return { manifest, actions: new Map() };
}

/**
 * Register a server action in the RSC context
 */
export async function registerAction(
  ctx: RSCContext,
  id: string,
  fn: (...args: unknown[]) => unknown,
): Promise<void> {
  const registeredFn = registerServerReference(fn, id, id);
  ctx.actions.set(id, { fn: registeredFn as (...args: unknown[]) => unknown, id });
}

/**
 * Register multiple server actions at once
 */
export async function registerActions(
  ctx: RSCContext,
  actions: Record<string, (...args: unknown[]) => unknown>,
): Promise<void> {
  for (const [id, fn] of Object.entries(actions)) {
    const registeredFn = registerServerReference(fn, id, id);
    ctx.actions.set(id, { fn: registeredFn as (...args: unknown[]) => unknown, id });
  }
}

/**
 * Create a client module proxy for use in server components
 */
export async function createClientProxy<T = Record<string, unknown>>(moduleId: string): Promise<T> {
  return createClientModuleProxy(moduleId) as T;
}

/**
 * Render a React element to an RSC stream
 */
export async function renderRSC(
  element: ReactNode,
  ctx: RSCContext,
  options?: RSCRenderOptions,
): Promise<ReadableStream<Uint8Array>> {
  return renderToReadableStream(element, ctx.manifest, {
    onError:
      options?.onError ??
      ((err) => {
        console.error("[rsc-sw-bff] Render error:", err);
        return "An error occurred during server rendering.";
      }),
    signal: options?.signal,
  });
}

/**
 * Decode encoded action arguments back to JavaScript values
 */
export async function decodeActionArgs(encoded: EncodedActionArgs): Promise<unknown[]> {
  let body: FormData | string;
  if (encoded.type === "formdata") {
    if (encoded.data instanceof FormData) {
      body = encoded.data;
    } else {
      body = new FormData();
      for (const [key, value] of new URLSearchParams(encoded.data)) {
        body.append(key, value);
      }
    }
  } else {
    body = encoded.data;
  }

  const decoded = await decodeReply(body, {});
  return Array.isArray(decoded) ? decoded : [decoded];
}

/**
 * Execute a server action and return the result as an RSC stream
 */
export async function handleAction(
  ctx: RSCContext,
  actionId: string,
  encodedArgs: EncodedActionArgs,
  options?: RSCRenderOptions,
): Promise<ReadableStream<Uint8Array>> {
  const action = ctx.actions.get(actionId);
  if (!action) {
    const available = Array.from(ctx.actions.keys()).join(", ") || "(none)";
    throw new Error(`Action "${actionId}" not found. Available: ${available}`);
  }

  const args = await decodeActionArgs(encodedArgs);
  const result = await action.fn(...args);

  return renderToReadableStream(result as ReactNode, ctx.manifest, {
    onError: options?.onError,
  });
}

/**
 * Extract action ID from request headers (React convention)
 */
export function getActionIdFromRequest(request: Request): string | null {
  return request.headers.get("rsc-action") ?? request.headers.get("x-rsc-action") ?? null;
}

/**
 * Check if a request is an RSC action request
 */
export function isActionRequest(request: Request): boolean {
  return getActionIdFromRequest(request) !== null;
}

/**
 * Configuration for createRSC
 */
export interface CreateRSCConfig<TComponents extends Record<string, unknown>> {
  moduleId: string;
  components: (keyof TComponents & string)[];
  actions?: Record<string, (...args: unknown[]) => unknown>;
}

/**
 * Result from createRSC
 */
export interface CreateRSCResult<TComponents> {
  ctx: RSCContext;
  Client: TComponents;
  ready: Promise<void>;
}

/**
 * Create RSC context, client proxy, and register actions in one call
 */
export function createRSC<TComponents extends Record<string, unknown>>(
  config: CreateRSCConfig<TComponents>,
): CreateRSCResult<TComponents> {
  const manifest: ClientManifest = {
    [config.moduleId]: { id: config.moduleId, chunks: [], name: "*" },
  };
  for (const name of config.components) {
    manifest[`${config.moduleId}#${name}`] = { id: config.moduleId, chunks: [], name };
  }

  const ctx = createRSCContext(manifest);
  const Client = createClientModuleProxy(config.moduleId) as TComponents;

  if (config.actions) {
    for (const [id, fn] of Object.entries(config.actions)) {
      const registeredFn = registerServerReference(fn, id, id);
      ctx.actions.set(id, { fn: registeredFn as (...args: unknown[]) => unknown, id });
    }
  }

  return { ctx, Client, ready: Promise.resolve() };
}

export type { ClientManifest, RSCContext, RSCRenderOptions, EncodedActionArgs };
