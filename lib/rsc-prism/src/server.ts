/**
 * RSC Server Module - For Service Worker
 *
 * Provides utilities for rendering React Server Components
 * and handling server actions within a service worker.
 *
 * IMPORTANT: Import webpack-shim before this module:
 * ```ts
 * import './rsc/webpack-shim';
 * import { renderRSC } from './rsc/server';
 * ```
 */

import type { ReactNode } from "react";
import "./runtime/webpack-shim";
import { resolveClientManifestOrThrow } from "./runtime/client-manifest";
import type { ClientManifest, EncodedActionArgs, RSCContext, RSCRenderOptions } from "./types";
import * as ReactServerDomWebpackServer from "react-server-dom-webpack/server.browser";

const { createClientModuleProxy, decodeReply, registerServerReference, renderToReadableStream } =
  ReactServerDomWebpackServer as unknown as {
    createClientModuleProxy: (moduleId: string) => unknown;
    decodeReply: (body: FormData | string, options: Record<string, unknown>) => Promise<unknown>;
    registerServerReference: <T>(fn: T, id: string, name: string) => T;
    renderToReadableStream: (
      element: ReactNode,
      manifest: ClientManifest,
      options: {
        onError?: ((error: unknown) => string | void) | undefined;
        signal?: AbortSignal | undefined;
      },
    ) => Promise<ReadableStream<Uint8Array>>;
  };

/**
 * Create an RSC context for rendering
 */
export function createRSCContext(manifest?: ClientManifest): RSCContext {
  return { manifest: resolveClientManifestOrThrow(manifest), actions: new Map() };
}

/**
 * Register a server action in the RSC context
 *
 * @example
 * ```ts
 * const ctx = createRSCContext(manifest);
 * await registerAction(ctx, 'incrementCount', async (count: number) => count + 1);
 * ```
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
 * Build action IDs from a module namespace.
 * Each function export becomes `${moduleId}#${exportName}`.
 */
export function createActionModuleMap(
  moduleId: string,
  moduleExports: Record<string, unknown>,
): Record<string, (...args: unknown[]) => unknown> {
  const actions: Record<string, (...args: unknown[]) => unknown> = {};
  for (const [exportName, value] of Object.entries(moduleExports)) {
    if (typeof value !== "function") {
      continue;
    }
    if (exportName.startsWith("__rscPrism")) {
      continue;
    }
    actions[`${moduleId}#${exportName}`] = value as (...args: unknown[]) => unknown;
  }
  return actions;
}

/**
 * Register all function exports from a module namespace as actions.
 */
export async function registerActionModule(
  ctx: RSCContext,
  moduleId: string,
  moduleExports: Record<string, unknown>,
): Promise<void> {
  await registerActions(ctx, createActionModuleMap(moduleId, moduleExports));
}

/**
 * Create a client module proxy for use in server components
 *
 * This allows server components to reference client components:
 * ```tsx
 * const Client = createClientProxy('client');
 * // In server component:
 * <Client.Counter initialCount={0} />
 * ```
 */
export async function createClientProxy<T = Record<string, unknown>>(moduleId: string): Promise<T> {
  return createClientModuleProxy(moduleId) as T;
}

/**
 * Render a React element to an RSC stream
 *
 * @example
 * ```ts
 * const stream = await renderRSC(<App />, ctx);
 * return new Response(stream, {
 *   headers: { 'Content-Type': 'text/x-component' }
 * });
 * ```
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
 *
 * @example
 * ```ts
 * const stream = await handleAction(ctx, 'incrementCount', encodedArgs);
 * return new Response(stream, {
 *   headers: { 'Content-Type': 'text/x-component' }
 * });
 * ```
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
  // React sends action ID in various headers
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
  /** Module ID for client components (e.g., "client") */
  moduleId: string;
  /** List of component names to include in manifest */
  components: (keyof TComponents & string)[];
  /** Server actions to register */
  actions?: Record<string, (...args: unknown[]) => unknown>;
}

/**
 * Result from createRSC
 */
export interface CreateRSCResult<TComponents> {
  /** RSC context for rendering and actions */
  ctx: RSCContext;
  /** Typed client component proxy */
  Client: TComponents;
  /** Promise that resolves when setup is complete */
  ready: Promise<void>;
}

/**
 * Create RSC context, client proxy, and register actions in one call
 *
 * @example
 * ```tsx
 * import type * as ClientComponents from "./components";
 *
 * const { ctx, Client, ready } = createRSC<typeof ClientComponents>({
 *   moduleId: "client",
 *   components: ["Counter", "Button", "Card"],
 *   actions: {
 *     increment: async (count) => (count as number) + 1,
 *     decrement: async (count) => (count as number) - 1,
 *   },
 * });
 *
 * // Use in routes:
 * ...http.rscRoutes("/rsc", () => <Client.Counter count={0} />, ctx, { ready })
 * ```
 */
export async function createRSC<TComponents extends Record<string, unknown>>(
  config: CreateRSCConfig<TComponents>,
): Promise<CreateRSCResult<TComponents>> {
  // Build manifest from component names
  const manifest: ClientManifest = {
    [config.moduleId]: { id: config.moduleId, chunks: [], name: "*" },
  };
  for (const name of config.components) {
    manifest[`${config.moduleId}#${name}`] = { id: config.moduleId, chunks: [], name };
  }

  // Create context
  const ctx = createRSCContext(manifest);
  const Client = createClientModuleProxy(config.moduleId) as TComponents;

  // Register actions if provided
  if (config.actions) {
    for (const [id, fn] of Object.entries(config.actions)) {
      const registeredFn = registerServerReference(fn, id, id);
      ctx.actions.set(id, { fn: registeredFn as (...args: unknown[]) => unknown, id });
    }
  }

  const ready = Promise.resolve();

  return { ctx, Client, ready };
}

// Re-export types for convenience
export type { ClientManifest, RSCContext, RSCRenderOptions, EncodedActionArgs };
