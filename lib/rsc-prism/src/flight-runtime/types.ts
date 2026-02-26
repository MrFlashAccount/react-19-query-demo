import type { ClientManifest } from "../types";

export interface FlightClientOptions {
  moduleBaseURL?: string;
  manifest?: ClientManifest;
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>;
  /** When true, recursively materialize all deferred chunks before resolving. Single suspend. Default false preserves lazy wrappers (one suspend per chunk). */
  materializeDeferredChunks?: boolean;
}

export interface FlightServerRenderOptions {
  onError?: ((error: unknown) => string | void) | undefined;
  signal?: AbortSignal | undefined;
  /** When true (default), skip template compaction and path tree building for 5–10x faster encode. */
  fastMode?: boolean;
}
