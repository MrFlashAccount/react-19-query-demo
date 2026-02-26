/**
 * RSC Server Module - For Service Worker
 *
 * Provides utilities for rendering React Server Components within a service worker.
 * Action registration and execution live in the actions module.
 */

import type { ReactNode } from "react";
import { resolveClientManifestOrThrow } from "./runtime/client-manifest";
import { buildClientManifestBaseUrl } from "./runtime/module-registry";
import type { ClientManifest, EncodedActionArgs, RSCContext, RSCRenderOptions } from "./types";
import { registerActions } from "./actions";
import { defaultFlightProtocolAdapter } from "./actions/adapter";
import { createClientModuleProxy } from "./module-references";
import type { FlightRowEmit } from "./flight-runtime/server";

/**
 * Create an RSC context for rendering.
 */
export function createRSCContext(manifest?: ClientManifest): RSCContext {
  return { manifest: resolveClientManifestOrThrow(manifest), actions: new Map() };
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

export async function renderRSCRows(
  element: ReactNode,
  ctx: RSCContext,
  emit: FlightRowEmit,
  options?: RSCRenderOptions,
): Promise<void> {
  await defaultFlightProtocolAdapter.renderRows(element, ctx.manifest, emit, {
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
 * // Use with worker row handler (postMessage):
 * handler.renderRows(<Client.Counter count={0} />, emit);
 * ```
 */
export async function createRSC<TComponents extends Record<string, unknown>>(
  config: CreateRSCConfig<TComponents>,
): Promise<CreateRSCResult<TComponents>> {
  const manifest: ClientManifest = buildClientManifestBaseUrl(config.moduleId);

  const ctx = createRSCContext(manifest);
  const Client = createClientModuleProxy(config.moduleId) as TComponents;

  if (config.actions) {
    await registerActions(ctx, config.actions);
  }

  const ready = Promise.resolve();

  return { ctx, Client, ready };
}

/**
 * Options for creating a worker row handler (postMessage-only, no Request/Response).
 */
export interface CreateWorkerRowHandlerOptions {
  manifest?: ClientManifest;
  actions?: Record<string, (...args: unknown[]) => unknown>;
  actionModules?: Array<{
    moduleId: string;
    moduleExports: Record<string, unknown>;
  }>;
  onError?: (error: unknown) => string | void;
}

/**
 * Create a worker row handler for postMessage-only transport.
 * Uses actionId/encodedArgs via postMessage.
 */
export async function createWorkerRowHandler(options: CreateWorkerRowHandlerOptions): Promise<{
  renderRows: (element: ReactNode, emit: FlightRowEmit) => Promise<void>;
  handleActionRows: (
    actionId: string,
    encodedArgs: EncodedActionArgs,
    emit: FlightRowEmit,
  ) => Promise<void>;
  executeAction: (actionId: string, encodedArgs: EncodedActionArgs) => Promise<unknown>;
}> {
  const { handleActionRows: handleActionRowsCore, executeAction: executeActionCore } =
    await import("./actions");
  const ctx = createRSCContext(options.manifest);
  const ready = (async () => {
    if (options.actions) {
      await registerActions(ctx, options.actions);
    }
    if (options.actionModules) {
      const { registerActionModule } = await import("./actions");
      for (const mod of options.actionModules) {
        await registerActionModule(ctx, mod.moduleId, mod.moduleExports);
      }
    }
  })();
  await ready;

  const renderRowsFn = (
    element: ReactNode,
    c: RSCContext,
    emit: FlightRowEmit,
    opts?: RSCRenderOptions,
  ) =>
    renderRSCRows(element, c, emit, {
      onError: opts?.onError ?? options.onError,
    });

  return {
    async renderRows(element: ReactNode, emit: FlightRowEmit): Promise<void> {
      await renderRowsFn(element, ctx, emit);
    },
    async handleActionRows(
      actionId: string,
      encodedArgs: EncodedActionArgs,
      emit: FlightRowEmit,
    ): Promise<void> {
      await handleActionRowsCore(ctx, actionId, encodedArgs, renderRowsFn, emit, {
        onError: options.onError,
      });
    },
    async executeAction(actionId: string, encodedArgs: EncodedActionArgs): Promise<unknown> {
      return executeActionCore(ctx, actionId, encodedArgs);
    },
  };
}

export type { ClientManifest, RSCContext, RSCRenderOptions, EncodedActionArgs };
