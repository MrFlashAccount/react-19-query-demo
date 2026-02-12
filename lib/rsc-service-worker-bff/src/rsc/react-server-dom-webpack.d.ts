/**
 * Type declarations for react-server-dom-webpack
 *
 * These types cover the subset of the API used by this library.
 * For full types, see: https://github.com/facebook/react/tree/main/packages/react-server-dom-webpack
 */

declare module "react-server-dom-webpack/server" {
  import type { ReactNode } from "react";

  export interface ClientManifest {
    [moduleId: string]: {
      id: string;
      chunks: string[];
      name: string;
    };
  }

  export interface RenderOptions {
    onError?: (error: unknown) => string | void;
    signal?: AbortSignal;
  }

  /**
   * Render a React element to an RSC stream
   */
  export function renderToReadableStream(
    element: ReactNode,
    clientManifest: ClientManifest,
    options?: RenderOptions,
  ): ReadableStream<Uint8Array>;

  /**
   * Register a function as a server reference (server action)
   */
  export function registerServerReference<T extends Function>(fn: T, id: string, name: string): T;

  /**
   * Create a proxy for client module imports
   */
  export function createClientModuleProxy<T = unknown>(moduleId: string): T;

  /**
   * Register a client reference
   */
  export function registerClientReference<T = unknown>(ref: T, moduleId: string, name: string): T;

  /**
   * Decode action arguments from wire format
   */
  export function decodeReply(
    body: FormData | string,
    webpackMap: Record<string, unknown>,
  ): Promise<unknown>;
}

declare module "react-server-dom-webpack/client" {
  export interface CreateFromStreamOptions {
    callServer?: (actionId: string, args: unknown[]) => Promise<unknown>;
  }

  /**
   * Create React elements from an RSC stream
   */
  export function createFromReadableStream<T = unknown>(
    stream: ReadableStream<Uint8Array>,
    options?: CreateFromStreamOptions,
  ): Promise<T>;

  /**
   * Create React elements from a fetch response promise
   * Convenience wrapper around createFromReadableStream
   */
  export function createFromFetch<T = unknown>(
    fetchPromise: Promise<Response>,
    options?: CreateFromStreamOptions,
  ): Promise<T>;

  /**
   * Encode action arguments for sending to server
   */
  export function encodeReply(args: unknown[]): Promise<FormData | string>;
}

declare module "react-server-dom-webpack/server.browser" {
  export * from "react-server-dom-webpack/server";
}

declare module "react-server-dom-webpack/client.browser" {
  export * from "react-server-dom-webpack/client";
}

declare module "web-streams-polyfill" {
  export class ReadableStream<R = unknown> extends globalThis.ReadableStream<R> {}
}
