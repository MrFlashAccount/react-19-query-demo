/**
 * RSC Types for Service Worker BFF
 */

import type { ReactNode, ComponentType } from "react";
import type { INVALIDATE_RSC_GLOBAL_KEY } from "./runtime-globals";

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
 * Client manifest in the ESM runtime.
 * This is the module base URL used by React Flight to resolve client references.
 */
export type ClientManifest = string;

/**
 * Encoded action arguments for transfer
 * Actions are serialized differently based on whether they contain FormData
 */
export type EncodedActionArgs =
  | { type: "formdata"; data: FormData | string }
  | { type: "string"; data: string };

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

/**
 * Options for creating an RSC handler
 */
export interface RSCHandlerOptions {
  /** Client manifest */
  manifest: ClientManifest;
  /** Server actions to register */
  actions?: Record<string, (...args: unknown[]) => unknown>;
}

/**
 * RSC stream response options
 */
export interface RSCResponseOptions {
  /** HTTP status code */
  status?: number;
  /** Custom headers */
  headers?: HeadersInit;
  /** Called when an error occurs */
  onError?: (error: unknown) => string | void;
}

export type ComponentReference<Props = unknown> = (
  props: Props,
) =>
  | (React.JSX.Element | null | React.JSX.Element[])
  | Promise<React.JSX.Element | null | React.JSX.Element[]>;

declare global {
  interface Window {
    [INVALIDATE_RSC_GLOBAL_KEY]: () => void;
  }
  interface WorkerGlobalScope {
    [INVALIDATE_RSC_GLOBAL_KEY]: () => void;
  }
}
