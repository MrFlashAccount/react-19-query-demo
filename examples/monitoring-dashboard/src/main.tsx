import "@lib/rsc-service-worker-bff/rsc/webpack-shim";

import { startTransition, StrictMode, Suspense, use, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryProvider, QueryClient } from "@lib/goat-query/react";

import { graph } from "@/queries";
import { router } from "@/router";
import { createWorker } from "@lib/rsc-service-worker-bff";
import { registerClientModule } from "@lib/rsc-service-worker-bff/rsc";
import { seedDatabase } from "@/db/seed";
import { startSimulation } from "@/db/simulation";
import { Loader } from "@/components/Loader";
import "./index.css";
import UIProviders from "./components/UIProviders";
import * as ServerClientComponents from "./routes/Server/client-components";

const worker = createWorker("/sw.js");

// Register client components for RSC
registerClientModule("server-monitoring", ServerClientComponents);

// Create query client
const queryClient = new QueryClient({ graph });
const workerStartPromise = worker.start();
const seedDatabasePromise = seedDatabase();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

let portalRoot: HTMLElement | null = document.querySelector("#portal-root");
if (!portalRoot) {
  portalRoot = document.createElement("div");
  portalRoot.id = "portal-root";
  document.body.appendChild(portalRoot);
}

startTransition(() => {
  createRoot(root).render(
    <StrictMode>
      <Suspense fallback={<Loader />}>
        <Bootstrap
          workerStartPromise={workerStartPromise}
          seedDatabasePromise={seedDatabasePromise}
        />
        <QueryProvider queryClient={queryClient}>
          <UIProviders portalRoot={portalRoot} appRoot={root} locale="en-US">
            <RouterProvider router={router} />
          </UIProviders>
        </QueryProvider>
      </Suspense>
    </StrictMode>,
  );
});

// Bootstrap app
function Bootstrap({
  workerStartPromise,
  seedDatabasePromise,
}: {
  workerStartPromise: Promise<ServiceWorkerRegistration>;
  seedDatabasePromise: Promise<{ servers: number; metrics: number; logs: number }>;
}) {
  use(workerStartPromise);
  use(seedDatabasePromise);

  useEffect(startSimulation, []);

  return null;
}
