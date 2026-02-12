/**
 * Service worker client adapter for @lib/rsc-prism.
 */

import {
  callAction as prismCallAction,
  consumeRSC,
  consumeRSCResponse,
  createCallServer as prismCreateCallServer,
  encodeActionArgs,
  fetchRSC as prismFetchRSC,
  type CallActionOptions as PrismCallActionOptions,
  type ConsumeRSCOptions,
  type RSCRequestOptions,
} from "@lib/rsc-prism/client";
import type { RSCTransport } from "@lib/rsc-prism/transport";

/**
 * Wait for service worker to be controlling the page.
 */
export async function ensureWorkerReady(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Workers not supported");
  }

  await navigator.serviceWorker.ready;

  if (navigator.serviceWorker.controller) {
    return;
  }

  await new Promise<void>((resolve) => {
    const onChange = () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      resolve();
    }
  });
}

export interface ServiceWorkerTransportOptions {
  waitForReady?: boolean;
}

export function createServiceWorkerTransport(
  options: ServiceWorkerTransportOptions = {},
): RSCTransport {
  const waitForReady = options.waitForReady ?? true;

  return {
    async sendAction(input) {
      if (waitForReady) {
        await ensureWorkerReady();
      }

      return fetch(input.endpoint, {
        method: "POST",
        body: input.body,
        headers: {
          "Content-Type": input.contentType,
          "x-rsc-action": input.actionId,
          ...input.headers,
        },
        ...input.requestInit,
      });
    },

    async fetchRSC(input) {
      if (waitForReady) {
        await ensureWorkerReady();
      }

      return fetch(input.url, {
        headers: {
          Accept: "text/x-component",
          ...input.headers,
        },
        ...input.requestInit,
      });
    },
  };
}

export function createCallServer(
  actionEndpoint: string,
  options?: Omit<RequestInit, "method" | "body"> & RSCRequestOptions & ServiceWorkerTransportOptions,
): (actionId: string, args: unknown[]) => Promise<unknown> {
  const transport = options?.transport ?? createServiceWorkerTransport(options);
  return prismCreateCallServer(actionEndpoint, {
    ...options,
    transport,
  });
}

export async function fetchRSC<T = unknown>(
  url: string,
  options?: RequestInit & ConsumeRSCOptions & RSCRequestOptions & ServiceWorkerTransportOptions,
): Promise<T> {
  const transport = options?.transport ?? createServiceWorkerTransport(options);
  return prismFetchRSC<T>(url, {
    ...options,
    transport,
  });
}

export interface CallActionOptions extends PrismCallActionOptions, ServiceWorkerTransportOptions {}

export async function callAction<T = void>(
  endpoint: string,
  actionId: string,
  args: unknown[],
  options?: CallActionOptions,
): Promise<T> {
  const transport = options?.transport ?? createServiceWorkerTransport(options);
  return prismCallAction<T>(endpoint, actionId, args, {
    ...options,
    transport,
  });
}

export {
  consumeRSC,
  consumeRSCResponse,
  encodeActionArgs,
  type ConsumeRSCOptions,
  type RSCRequestOptions,
};
