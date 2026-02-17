export interface FlightClientOptions {
  moduleBaseURL?: string;
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>;
}

export interface FlightServerRenderOptions {
  onError?: ((error: unknown) => string | void) | undefined;
  signal?: AbortSignal | undefined;
}
