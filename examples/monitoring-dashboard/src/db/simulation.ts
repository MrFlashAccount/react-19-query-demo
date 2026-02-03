// ─────────────────────────────────────────────────────────────────────────────
// Web Worker-based Simulation
// ─────────────────────────────────────────────────────────────────────────────

let worker: Worker | null = null;

export function startSimulation(): void {
  if (worker) return;

  // Create and start the worker
  worker = new Worker(new URL("./simulation.worker.ts", import.meta.url), {
    type: "module",
  });

  worker.onmessage = (event: MessageEvent) => {
    const { type } = event.data;

    if (type === "started") {
      console.log("[Simulation] Worker started");
    } else if (type === "stopped") {
      console.log("[Simulation] Worker stopped");
    } else if (type === "paused") {
      console.log("[Simulation] Worker paused");
    } else if (type === "resumed") {
      console.log("[Simulation] Worker resumed");
    }
  };

  worker.onerror = (error) => {
    console.error("[Simulation] Worker error:", error);
  };

  worker.postMessage({ type: "start" });
}

export function stopSimulation(): void {
  if (!worker) return;

  worker.postMessage({ type: "stop" });
  worker.terminate();
  worker = null;
}

export function pauseSimulation(): void {
  if (!worker) return;
  worker.postMessage({ type: "pause" });
}

export function resumeSimulation(): void {
  if (!worker) return;
  worker.postMessage({ type: "resume" });
}

export function isSimulationRunning(): boolean {
  return worker !== null;
}
