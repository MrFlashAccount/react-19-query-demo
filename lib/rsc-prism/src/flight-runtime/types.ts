import type { ClientManifest } from "../types";
import type { ComponentTraceTracker, RSCTraceContext } from "../tracing";

export interface FlightClientOptions {
  moduleBaseURL?: string;
  manifest?: ClientManifest;
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>;
  traceContext?: RSCTraceContext;
  componentTrace?: ComponentTraceTracker;
}

export interface FlightServerRenderOptions {
  onError?: ((error: unknown) => string | void) | undefined;
  signal?: AbortSignal | undefined;
  traceContext?: RSCTraceContext;
  componentTrace?: ComponentTraceTracker;
}
