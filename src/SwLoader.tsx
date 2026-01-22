import { use } from "react";

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service Workers not supported");
    return;
  }

  try {
    // Unregister old service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (!reg.active?.scriptURL.includes("movies-sw.js")) {
        await reg.unregister();
      }
    }

    // Register combined movies service worker (handles both JSON API and RSC)
    const registration = await navigator.serviceWorker.register("/movies-sw.js", {
      scope: "/",
    });

    // Wait for activation if installing
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        registration.installing!.addEventListener("statechange", function handler() {
          if (this.state === "activated") {
            this.removeEventListener("statechange", handler);
            resolve();
          }
        });
      });
    }

    await navigator.serviceWorker.ready;
    console.log("[SW] Movies service worker ready");
  } catch (error) {
    console.error("[SW] Failed to register service worker:", error);
  }
}

const promise = registerServiceWorker();

export function SwLoader() {
  use(promise);
  return null;
}
