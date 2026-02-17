import { use } from "react";

const BACKEND_SW_URL = "/movies-backend-sw.js";
const BACKEND_SW_BASENAME = "movies-backend-sw.js";

async function registerBackendServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported in this browser.");
    return;
  }

  // Clean up previously registered app service workers that may still control
  // requests and interfere with worker runtime script loading.
  const existingRegistrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    existingRegistrations.map(async (registration) => {
      const activeScript = registration.active?.scriptURL ?? "";
      const waitingScript = registration.waiting?.scriptURL ?? "";
      const installingScript = registration.installing?.scriptURL ?? "";
      const isBackendRegistration =
        activeScript.includes(BACKEND_SW_BASENAME) ||
        waitingScript.includes(BACKEND_SW_BASENAME) ||
        installingScript.includes(BACKEND_SW_BASENAME);
      if (!isBackendRegistration) {
        await registration.unregister();
      }
    }),
  );

  const registration = await navigator.serviceWorker.register(BACKEND_SW_URL, {
    scope: "/",
    type: "classic",
  });

  if (registration.installing) {
    await new Promise<void>((resolve) => {
      registration.installing?.addEventListener("statechange", function onStateChange() {
        if (this.state === "activated") {
          this.removeEventListener("statechange", onStateChange);
          resolve();
        }
      });
    });
  }

  await navigator.serviceWorker.ready;

  const controllerScript = navigator.serviceWorker.controller?.scriptURL ?? "";
  if (!controllerScript.includes(BACKEND_SW_BASENAME)) {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(() => resolve(), 1000);
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          window.clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    });
  }
}

const runtimeReadyPromise = (async () => {
  await registerBackendServiceWorker();
})();

export function RuntimeBootstrap() {
  use(runtimeReadyPromise);
  return null;
}
