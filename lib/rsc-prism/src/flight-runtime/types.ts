import type { ClientManifest } from "../types";
import type { ComponentTraceTracker, RSCTraceContext } from "../tracing";

export interface FlightClientOptions {
  moduleBaseURL?: string;
  manifest?: ClientManifest;
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>;
  traceContext?: RSCTraceContext;
  componentTrace?: ComponentTraceTracker;
  /** When true, recursively materialize all deferred chunks before resolving. Single suspend. Default false preserves lazy wrappers (one suspend per chunk). */
  materializeDeferredChunks?: boolean;
}

export interface FlightServerRenderOptions {
  onError?: ((error: unknown) => string | void) | undefined;
  signal?: AbortSignal | undefined;
  traceContext?: RSCTraceContext;
  componentTrace?: ComponentTraceTracker;
}
