/// <reference lib="webworker" />

import { compileRoute, matchRoute } from "./router";
import { error } from "./response";
import type { CompiledRoute, RouteDefinition, ServiceWorker, ServiceWorkerOptions } from "./types";

declare const self: ServiceWorkerGlobalScope;

let installedRoutes: CompiledRoute[] = [];
let installedOptions: ServiceWorkerOptions = {};

/**
 * Handle fetch events within the service worker
 */
function handleFetch(event: FetchEvent): void {
  const url = new URL(event.request.url);
  const { basePath = "" } = installedOptions;

  // Check if path matches base path
  if (basePath && !url.pathname.startsWith(basePath)) {
    return;
  }

  const pathname = basePath ? url.pathname.slice(basePath.length) || "/" : url.pathname;
  const method = event.request.method;

  const match = matchRoute(pathname, method, installedRoutes);

  if (!match) {
    // No route matched - use fallback or passthrough
    if (installedOptions.fallback) {
      event.respondWith(Promise.resolve(installedOptions.fallback(event.request)));
    }
    // If no fallback, let the request pass through to network
    return;
  }

  event.respondWith(
    (async () => {
      try {
        return await match.route.handler({
          request: event.request,
          url,
          params: match.params,
        });
      } catch (err) {
        console.error("[sw-bff] Handler error:", err);
        if (err instanceof Error) {
          return error(`${err.message}\n${err.stack ?? ""}`, 500);
        }
        return error(String(err), 500);
      }
    })(),
  );
}

/**
 * Install service worker event listeners
 */
function installListeners(): void {
  self.addEventListener("install", (event: ExtendableEvent) => {
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener("activate", (event: ExtendableEvent) => {
    event.waitUntil(self.clients.claim());
  });

  self.addEventListener("fetch", handleFetch);
}

/**
 * Setup the service worker with routes (call this from your SW file)
 *
 * @example
 * ```ts
 * // my-worker.ts
 * import { setupWorker, http, json } from 'rsc-service-worker-bff'
 *
 * setupWorker([
 *   http.get('/api/users', () => json([{ id: 1 }])),
 *   http.get('/api/users/:id', ({ params }) => json({ id: params.id })),
 * ])
 * ```
 */
export function setupWorker(routes: RouteDefinition[], options: ServiceWorkerOptions = {}): void {
  installedRoutes = routes.map(compileRoute);
  installedOptions = options;
  installListeners();
}

/**
 * Create a service worker instance for registration from main thread
 *
 * @example
 * ```ts
 * // main.ts
 * import { createWorker } from 'rsc-service-worker-bff'
 *
 * const worker = createWorker('/my-worker.js')
 * await worker.start()
 * ```
 */
export function createWorker(scriptUrl: string, options?: RegistrationOptions): ServiceWorker {
  let registration: ServiceWorkerRegistration | null = null;

  return {
    async start() {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service Workers are not supported in this browser");
      }

      registration = await navigator.serviceWorker.register(scriptUrl, options);

      // Wait for the service worker to be active
      const sw = registration.installing || registration.waiting || registration.active;

      if (sw && sw.state !== "activated") {
        await new Promise<void>((resolve) => {
          sw.addEventListener("statechange", function onChange() {
            if (sw.state === "activated") {
              sw.removeEventListener("statechange", onChange);
              resolve();
            }
          });
        });
      }

      return registration;
    },

    async stop() {
      if (registration) {
        await registration.unregister();
        registration = null;
      }
    },
  };
}
