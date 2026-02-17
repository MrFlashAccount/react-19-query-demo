/**
 * Client-only RSC utilities for main thread
 *
 * This module can be safely imported on the main thread without pulling in
 * react-server-dom-webpack/server which requires the react-server condition.
 */

// Client utilities (fetch/consume RSC)
export {
  consumeRSC,
  consumeRSCResponse,
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
