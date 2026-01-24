import { startTransition, StrictMode, Suspense, use, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryProvider, QueryClient } from "@lib/goat-query/react";

import { graph } from "./queries";
import { router } from "./router";
import "./index.css";
import { createWorker } from "@lib/rsc-service-worker-bff";
import { seedDatabase } from "./db/seed";
import { startSimulation } from "./db/simulation";

const worker = createWorker("/sw.js");

// Create query client
const queryClient = new QueryClient({ graph });
const workerStartPromise = worker.start();
const seedDatabasePromise = seedDatabase();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

startTransition(() => {
  createRoot(root).render(
    <StrictMode>
      <Suspense fallback={<Loader />}>
        <Bootstrap
          workerStartPromise={workerStartPromise}
          seedDatabasePromise={seedDatabasePromise}
        />
        <QueryProvider queryClient={queryClient}>
          <RouterProvider router={router} />
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
  useEffect(() => {
    startSimulation();
  }, []);
  return null;
}

function Loader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
    </div>
  );
}
