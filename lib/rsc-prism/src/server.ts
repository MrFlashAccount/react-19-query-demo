/**
 * RSC Server Module - For Service Worker
 *
 * Provides utilities for rendering React Server Components within a service worker.
 * Action registration and execution live in the actions module.
 */

import type { ReactNode } from "react";
import { resolveClientManifestOrThrow } from "./runtime/client-manifest";
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
  if (defaultFlightProtocolAdapter.renderRows == null) {
    throw new Error("[rsc-prism] Active Flight protocol adapter does not support row rendering.");
  }

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
 * // Use in routes:
 * ...http.rscRoutes("/rsc", () => <Client.Counter count={0} />, ctx, { ready })
 * ```
 */
export async function createRSC<TComponents extends Record<string, unknown>>(
  config: CreateRSCConfig<TComponents>,
): Promise<CreateRSCResult<TComponents>> {
  const slashIndex = config.moduleId.lastIndexOf("/");
  const manifest: ClientManifest =
    slashIndex === -1 ? "/" : config.moduleId.slice(0, slashIndex + 1);

  const ctx = createRSCContext(manifest);
  const Client = createClientModuleProxy(config.moduleId) as TComponents;

  if (config.actions) {
    await registerActions(ctx, config.actions);
  }

  const ready = Promise.resolve();

  return { ctx, Client, ready };
}

export type { ClientManifest, RSCContext, RSCRenderOptions, EncodedActionArgs };
