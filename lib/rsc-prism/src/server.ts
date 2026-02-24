/**
 * RSC Server Module - For Service Worker
 *
 * Provides utilities for rendering React Server Components
 * and handling server actions within a service worker.
 *
 */

import type { ReactNode } from "react";
import { resolveClientManifestOrThrow } from "./runtime/client-manifest";
import type { ClientManifest, EncodedActionArgs, RSCContext, RSCRenderOptions } from "./types";
import { registerServerReference } from "./flight-runtime/server";
import { defaultFlightProtocolAdapter } from "./flight-runtime/adapter";
import { createClientModuleProxy } from "./flight-runtime/references";
import type { FlightRowEmit } from "./flight-runtime/server";
import {
  createTraceRequestId,
  finishTraceSpanError,
  finishTraceSpanSuccess,
  startTraceSpan,
  summarizeArgs,
  type RSCTraceContext,
} from "./tracing";

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

function toServerTraceContext(traceContext?: RSCTraceContext): RSCTraceContext | undefined {
  if (traceContext == null) {
    return undefined;
  }
  return {
    ...traceContext,
    source: "server",
  };
}

function createActionTraceContext(
  actionId: string,
  traceContext?: RSCTraceContext,
): RSCTraceContext {
  const serverTrace = toServerTraceContext(traceContext);
  return {
    requestId: serverTrace?.requestId ?? createTraceRequestId("server-action"),
    actionId,
    parentSpan: serverTrace?.parentSpan,
    source: "server",
  };
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
  const traceContext = toServerTraceContext(options?.traceContext);
  const span = startTraceSpan(
    "rsc.server.renderRSC",
    {
      requestId: traceContext?.requestId,
      actionId: traceContext?.actionId,
      source: "server",
    },
    traceContext?.parentSpan,
    "secondary",
  );
  try {
    const stream = await defaultFlightProtocolAdapter.renderStream(element, ctx.manifest, {
      onError:
        options?.onError ??
        ((err) => {
          console.error("[rsc-sw-bff] Render error:", err);
          return "An error occurred during server rendering.";
        }),
      signal: options?.signal,
      traceContext,
    });
    finishTraceSpanSuccess(span);
    return stream;
  } catch (error) {
    finishTraceSpanError(span, error);
    throw error;
  }
}

export async function renderRSCRows(
  element: ReactNode,
  ctx: RSCContext,
  emit: FlightRowEmit,
  options?: RSCRenderOptions,
): Promise<void> {
  const traceContext = toServerTraceContext(options?.traceContext);
  const span = startTraceSpan(
    "rsc.server.renderRSCRows",
    {
      requestId: traceContext?.requestId,
      actionId: traceContext?.actionId,
      source: "server",
    },
    traceContext?.parentSpan,
    "secondary",
  );
  if (defaultFlightProtocolAdapter.renderRows == null) {
    finishTraceSpanError(
      span,
      new Error("[rsc-prism] Active Flight protocol adapter does not support row rendering."),
    );
    throw new Error("[rsc-prism] Active Flight protocol adapter does not support row rendering.");
  }

  try {
    await defaultFlightProtocolAdapter.renderRows(element, ctx.manifest, emit, {
      onError:
        options?.onError ??
        ((err) => {
          console.error("[rsc-sw-bff] Render error:", err);
          return "An error occurred during server rendering.";
        }),
      signal: options?.signal,
      traceContext,
    });
    finishTraceSpanSuccess(span);
  } catch (error) {
    finishTraceSpanError(span, error);
    throw error;
  }
}

/**
 * Decode encoded action arguments back to JavaScript values
 */
export async function decodeActionArgs(
  encoded: EncodedActionArgs,
  traceContext?: RSCTraceContext,
): Promise<unknown[]> {
  const span = startTraceSpan(
    "rsc.server.decodeActionArgs",
    {
      requestId: traceContext?.requestId,
      actionId: traceContext?.actionId,
      source: "server",
      encodedType: encoded.type,
    },
    traceContext?.parentSpan,
    "secondary",
  );
  const manifest = resolveClientManifestOrThrow();
  try {
    const decoded = await defaultFlightProtocolAdapter.decodeActionArgs(encoded, manifest);
    const args = Array.isArray(decoded) ? decoded : [decoded];
    finishTraceSpanSuccess(span, {
      argsCount: args.length,
    });
    return args;
  } catch (error) {
    finishTraceSpanError(span, error);
    throw error;
  }
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
  const traceContext = createActionTraceContext(actionId, options?.traceContext);
  const span = startTraceSpan(
    "rsc.server.handleAction",
    {
      requestId: traceContext.requestId,
      actionId,
      source: "server",
    },
    traceContext.parentSpan,
    "secondary",
  );
  try {
    const result = await executeAction(ctx, actionId, encodedArgs, {
      ...traceContext,
      parentSpan: span,
    });
    const stream = await defaultFlightProtocolAdapter.renderStream(result as ReactNode, ctx.manifest, {
      onError: options?.onError,
      signal: options?.signal,
      traceContext: {
        ...traceContext,
        parentSpan: span,
      },
    });
    finishTraceSpanSuccess(span);
    return stream;
  } catch (error) {
    finishTraceSpanError(span, error);
    throw error;
  }
}

export async function executeAction(
  ctx: RSCContext,
  actionId: string,
  encodedArgs: EncodedActionArgs,
  traceContext?: RSCTraceContext,
): Promise<unknown> {
  const resolvedTraceContext = createActionTraceContext(actionId, traceContext);
  const span = startTraceSpan(
    "rsc.server.executeAction",
    {
      requestId: resolvedTraceContext.requestId,
      actionId,
      source: "server",
    },
    resolvedTraceContext.parentSpan,
  );
  const action = ctx.actions.get(actionId);
  if (!action) {
    const available = Array.from(ctx.actions.keys()).join(", ") || "(none)";
    const error = new Error(`Action "${actionId}" not found. Available: ${available}`);
    finishTraceSpanError(span, error);
    throw error;
  }

  try {
    const args = await decodeActionArgs(encodedArgs, {
      ...resolvedTraceContext,
      parentSpan: span,
    });
    const result = await action.fn(...args);
    finishTraceSpanSuccess(span, summarizeArgs(args));
    return result;
  } catch (error) {
    finishTraceSpanError(span, error);
    throw error;
  }
}

export async function handleActionRows(
  ctx: RSCContext,
  actionId: string,
  encodedArgs: EncodedActionArgs,
  emit: FlightRowEmit,
  options?: RSCRenderOptions,
): Promise<void> {
  const traceContext = createActionTraceContext(actionId, options?.traceContext);
  const span = startTraceSpan(
    "rsc.server.handleActionRows",
    {
      requestId: traceContext.requestId,
      actionId,
      source: "server",
    },
    traceContext.parentSpan,
    "secondary",
  );
  try {
    const result = await executeAction(ctx, actionId, encodedArgs, {
      ...traceContext,
      parentSpan: span,
    });
    await renderRSCRows(result as ReactNode, ctx, emit, {
      onError: options?.onError,
      signal: options?.signal,
      traceContext: {
        ...traceContext,
        parentSpan: span,
      },
    });
    finishTraceSpanSuccess(span);
  } catch (error) {
    finishTraceSpanError(span, error);
    throw error;
  }
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
  const slashIndex = config.moduleId.lastIndexOf("/");
  const manifest: ClientManifest =
    slashIndex === -1 ? "/" : config.moduleId.slice(0, slashIndex + 1);

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
