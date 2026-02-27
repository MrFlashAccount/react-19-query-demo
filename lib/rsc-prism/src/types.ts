/**
 * RSC Types for Service Worker BFF
 */

import type { ReactNode, ComponentType } from "react";

/**
 * ESM module reference identifier used by RSC.
 * Format: <module-specifier>#<export-name>
 */
export type RscModuleReferenceId = string;

/**
 * ESM server action identifier used by RSC.
 * Format: <module-specifier>#<export-name>
 */
export type RscActionId = string;

/**
 * Client manifest entry aligned with Flight-like module maps.
 */
export interface ClientManifestEntry {
  id: string;
  name: string;
  chunks: string[];
  async?: boolean;
}

/**
 * Client manifest map keyed by "<moduleId>#<exportName>".
 */
export type ClientManifestMap = Record<string, ClientManifestEntry>;

/**
 * Client manifest in the ESM runtime.
 *
 * - string: legacy base URL compatibility mode.
 * - map: explicit per-export module map.
 */
export type ClientManifest = string | ClientManifestMap;

/**
 * Encoded action arguments for postMessage transfer.
 * Structured-clone payload (Map, Set, Date, etc. pass through natively).
 */
export type EncodedActionArgs = { type: "object"; data: unknown };

/**
 * Server module exports - what a server component module provides
 */
export interface ServerModule {
  /** Default export (typically the root component) */
  default?: ComponentType | ReactNode;
  /** Named exports (server actions, etc.) */
  [key: string]: unknown;
}

/**
 * RSC render options
 */
export interface RSCRenderOptions {
  /** Called when an error occurs during rendering */
  onError?: (error: unknown) => string | void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Server action registry entry
 */
export interface ServerActionEntry {
  /** Action function */
  fn: (...args: unknown[]) => unknown;
  /** Action ID */
  id: RscActionId;
}

/**
 * RSC context passed to render functions
 */
export interface RSCContext {
  /** Client manifest for resolving client components */
  manifest: ClientManifest;
  /** Registered server actions */
  actions: Map<string, ServerActionEntry>;
}

export type ComponentReference<Props = unknown> = (
  props: Props,
) =>
  | (React.JSX.Element | null | React.JSX.Element[])
  | Promise<React.JSX.Element | null | React.JSX.Element[]>;
