import { use } from "react";

async function registerServiceWorker() {
  await navigator.serviceWorker
    .register("./movieApi.service-worker.js", { scope: "/" })
    .catch((error) => {
      console.error("Failed to register service worker:", error);
    });
}

const promise = registerServiceWorker();

export function SwLoader() {
  use(promise);
  return null;
}
