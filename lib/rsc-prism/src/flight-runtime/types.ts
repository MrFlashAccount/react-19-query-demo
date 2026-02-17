import type { ClientManifest } from "../types";

export interface FlightClientOptions {
  moduleBaseURL?: string;
  manifest?: ClientManifest;
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>;
}

export interface FlightServerRenderOptions {
  onError?: ((error: unknown) => string | void) | undefined;
  signal?: AbortSignal | undefined;
}
