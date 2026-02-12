/**
 * RSC Types for Service Worker BFF
 */

import type { ReactNode, ComponentType } from "react";

/**
 * Client manifest entry - describes a client component module
 */
export interface ClientManifestEntry {
  /** Module identifier */
  id: string;
  /** Chunk files to load (empty for service worker - all pre-loaded) */
  chunks: string[];
  /** Export name (* for default/namespace) */
  name: string;
}

/**
 * Client manifest - maps module references to their metadata
 * Used by RSC to serialize client component references
 */
export type ClientManifest = Record<string, ClientManifestEntry>;

/**
 * Encoded action arguments for transfer
 * Actions are serialized differently based on whether they contain FormData
 */
export type EncodedActionArgs =
  | { type: "formdata"; data: string }
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
  id: string;
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
