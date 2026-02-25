/**
 * Client-only RSC utilities for main thread
 *
 * This module can be safely imported on the main thread without pulling in
 * server-only RSC bindings.
 */

// Client utilities (fetch RSC via worker row transport)
export {
  bootstrapWorkerRuntime,
  encodeActionArgs,
  createCallServer,
  fetchRSC,
  callAction,
  type BootstrappedWorkerRuntime,
  type ConsumeRSCOptions,
  type FetchRSCOptions,
  type WorkerComponentReference,
  type WorkerActionReference,
  type CallActionOptions,
  type RSCRequestOptions,
} from "./client";
