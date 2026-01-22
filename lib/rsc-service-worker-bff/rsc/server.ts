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
import type { ClientManifest, EncodedActionArgs, RSCContext, RSCRenderOptions } from "./types";

// Lazy imports to ensure webpack-shim loads first
let _renderToReadableStream: typeof import("react-server-dom-webpack/server").renderToReadableStream;
let _registerServerReference: typeof import("react-server-dom-webpack/server").registerServerReference;
let _createClientModuleProxy: typeof import("react-server-dom-webpack/server").createClientModuleProxy;
let _decodeReply: typeof import("react-server-dom-webpack/server").decodeReply;

async function ensureImports(): Promise<void> {
  if (!_renderToReadableStream) {
    const mod = await import("react-server-dom-webpack/server");
    _renderToReadableStream = mod.renderToReadableStream;
    _registerServerReference = mod.registerServerReference;
    _createClientModuleProxy = mod.createClientModuleProxy;
    _decodeReply = mod.decodeReply;
  }
}

/**
 * Create an RSC context for rendering
 */
export function createRSCContext(manifest: ClientManifest): RSCContext {
  return {
    manifest,
    actions: new Map(),
  };
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
  await ensureImports();
  const registeredFn = _registerServerReference(fn, id, id);
  ctx.actions.set(id, { fn: registeredFn as (...args: unknown[]) => unknown, id });
}

/**
 * Register multiple server actions at once
 */
export async function registerActions(
  ctx: RSCContext,
  actions: Record<string, (...args: unknown[]) => unknown>,
): Promise<void> {
  await ensureImports();
  for (const [id, fn] of Object.entries(actions)) {
    const registeredFn = _registerServerReference(fn, id, id);
    ctx.actions.set(id, { fn: registeredFn as (...args: unknown[]) => unknown, id });
  }
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
  await ensureImports();
  return _createClientModuleProxy(moduleId) as T;
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
  await ensureImports();

  return _renderToReadableStream(element, ctx.manifest, {
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
  await ensureImports();

  let body: FormData | string;
  if (encoded.type === "formdata") {
    body = new FormData();
    for (const [key, value] of new URLSearchParams(encoded.data)) {
      body.append(key, value);
    }
  } else {
    body = encoded.data;
  }

  const decoded = await _decodeReply(body, {});
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
  await ensureImports();

  // Handle "module#export" format
  const actionName = actionId.includes("#") ? (actionId.split("#")[1] ?? actionId) : actionId;

  const action = ctx.actions.get(actionName);
  if (!action) {
    const available = Array.from(ctx.actions.keys()).join(", ") || "(none)";
    throw new Error(`Action "${actionName}" not found. Available: ${available}`);
  }

  const args = await decodeActionArgs(encodedArgs);
  const result = await action.fn(...args);

  return _renderToReadableStream(result as ReactNode, ctx.manifest, {
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

// Symbol for client references
const REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference");

/**
 * Create a client module proxy synchronously (no async imports needed)
 *
 * This creates a Proxy that generates client references on-demand for any property access.
 * Works the same as react-server-dom-webpack's createClientModuleProxy but without async.
 */
function createSyncClientProxy<T extends Record<string, unknown>>(moduleId: string): T {
  const cache = new Map<string, unknown>();

  return new Proxy({} as T, {
    get(_target, prop: string) {
      if (cache.has(prop)) {
        return cache.get(prop);
      }

      // Create a client reference for this property
      const ref = {
        $$typeof: REACT_CLIENT_REFERENCE,
        $$id: `${moduleId}#${prop}`,
        name: prop,
      };

      cache.set(prop, ref);
      return ref;
    },
  });
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
export function createRSC<TComponents extends Record<string, unknown>>(
  config: CreateRSCConfig<TComponents>,
): CreateRSCResult<TComponents> {
  // Build manifest from component names
  const manifest: ClientManifest = {
    [config.moduleId]: { id: config.moduleId, chunks: [], name: "*" },
  };
  for (const name of config.components) {
    manifest[`${config.moduleId}#${name}`] = { id: config.moduleId, chunks: [], name };
  }

  // Create context
  const ctx = createRSCContext(manifest);

  // Create client proxy synchronously - no async needed!
  // This works because client references are just marker objects
  const Client = createSyncClientProxy<TComponents>(config.moduleId);

  // Initialize async (only needed for actions)
  const ready = (async () => {
    // Register actions if provided
    if (config.actions) {
      await ensureImports();
      for (const [id, fn] of Object.entries(config.actions)) {
        const registeredFn = _registerServerReference(fn, id, id);
        ctx.actions.set(id, { fn: registeredFn as (...args: unknown[]) => unknown, id });
      }
    }
  })();

  return { ctx, Client, ready };
}

// Re-export types for convenience
export type { ClientManifest, RSCContext, RSCRenderOptions, EncodedActionArgs };
