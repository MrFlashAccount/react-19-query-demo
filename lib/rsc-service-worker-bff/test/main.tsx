/**
 * RSC Service Worker Playground - Main Entry
 *
 * Consumes RSC payloads from the service worker and renders them.
 */

// Import webpack shim FIRST - required for react-server-dom-webpack
import "../rsc/webpack-shim";

import { useState, useEffect, useCallback, Suspense, use } from "react";
import { createRoot } from "react-dom/client";
import { createWorker } from "../src/worker";
import { registerClientModule, fetchRSC, polyfillReady } from "../src/rsc";

// Import client components and register them
import * as ClientComponents from "./components";
registerClientModule("client", ClientComponents);

// Types
interface LogEntry {
  id: number;
  time: string;
  type: "info" | "success" | "error" | "rsc";
  message: string;
}

// Service worker instance
const worker = createWorker("/sw.js");

// Log state (global for simplicity)
let logId = 0;
let logListeners: ((logs: LogEntry[]) => void)[] = [];
let logs: LogEntry[] = [];

function addLog(type: LogEntry["type"], message: string) {
  const entry: LogEntry = {
    id: ++logId,
    time: new Date().toLocaleTimeString(),
    type,
    message,
  };
  logs = [...logs, entry].slice(-50);
  logListeners.forEach((fn) => fn(logs));
}

function useLogs() {
  const [state, setState] = useState<LogEntry[]>(logs);
  useEffect(() => {
    logListeners.push(setState);
    return () => {
      logListeners = logListeners.filter((fn) => fn !== setState);
    };
  }, []);
  return state;
}

// ========== Components ==========

function StatusBar({
  swStatus,
  polyfillStatus,
}: {
  swStatus: "pending" | "active" | "error";
  polyfillStatus: "pending" | "ready" | "error";
}) {
  return (
    <div className="status-bar">
      <div className="status-badge">
        <span
          className={`status-dot ${swStatus === "active" ? "active" : swStatus === "error" ? "error" : ""}`}
        />
        Service Worker: {swStatus}
      </div>
      <div className="status-badge">
        <span
          className={`status-dot ${polyfillStatus === "ready" ? "active" : polyfillStatus === "error" ? "error" : ""}`}
        />
        RSC Polyfill: {polyfillStatus}
      </div>
    </div>
  );
}

function LogViewer() {
  const entries = useLogs();

  return (
    <div className="card">
      <h2 className="card-title">📋 Event Log</h2>
      <div className="log-container">
        {entries.length === 0 ? (
          <div style={{ color: "var(--text-secondary)" }}>No events yet...</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="log-entry">
              <span className="log-time">{entry.time}</span>
              <span className={`log-type ${entry.type}`}>{entry.type.toUpperCase()}</span>
              <span>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Component that uses the RSC promise with React's `use` hook
function RSCContent({ promise }: { promise: Promise<React.ReactNode> }) {
  const content = use(promise);
  return <div className="rsc-content">{content}</div>;
}

function RSCLoader({ rscPromise }: { rscPromise: Promise<React.ReactNode> | null }) {
  if (!rscPromise) {
    return <div className="loading">Click "Fetch RSC" to load server component</div>;
  }

  return (
    <Suspense
      fallback={
        <div className="loading">
          <div className="spinner" />
          Loading RSC stream...
        </div>
      }
    >
      <RSCContent promise={rscPromise} />
    </Suspense>
  );
}

function App() {
  const [swStatus, setSwStatus] = useState<"pending" | "active" | "error">("pending");
  const [polyfillStatus, setPolyfillStatus] = useState<"pending" | "ready" | "error">("pending");
  const [rscPromise, setRscPromise] = useState<Promise<React.ReactNode> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize service worker and polyfill
  useEffect(() => {
    const init = async () => {
      try {
        addLog("info", "Loading RSC polyfill...");
        await polyfillReady;
        setPolyfillStatus("ready");
        addLog("success", "RSC polyfill ready");
      } catch (err) {
        setPolyfillStatus("error");
        addLog("error", `Polyfill failed: ${err}`);
      }

      try {
        addLog("info", "Starting service worker...");
        await worker.start();
        setSwStatus("active");
        addLog("success", "Service worker activated");
      } catch (err) {
        setSwStatus("error");
        addLog("error", `Service worker failed: ${err}`);
      }
    };

    init();

    return () => {
      worker.stop();
    };
  }, []);

  // Create callServer function for server actions
  // This sends action requests to the service worker
  const callServer = useCallback(async (actionId: string, args: unknown[]): Promise<unknown> => {
    addLog("rsc", `Calling server action: ${actionId}`);

    const response = await fetch("/rsc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rsc-action": actionId,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const error = await response.text();
      addLog("error", `Server action failed: ${error}`);
      throw new Error(error);
    }

    // The response is an RSC stream containing the action result
    const { consumeRSC } = await import("../src/rsc/client");
    const result = await consumeRSC<unknown>(response.body!, { callServer });
    addLog("success", `Server action result: ${JSON.stringify(result)}`);
    return result;
  }, []);

  const handleFetchRSC = useCallback(async () => {
    setError(null);
    addLog("rsc", "Fetching RSC from /rsc...");

    try {
      const promise = fetchRSC<React.ReactNode>("/rsc", { callServer });
      setRscPromise(promise);
      await promise;
      addLog("success", "RSC loaded successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      addLog("error", `RSC fetch failed: ${message}`);
    }
  }, [callServer]);

  const handleRefresh = useCallback(() => {
    setRscPromise(null);
    setError(null);
    addLog("info", "Cleared RSC content");
  }, []);

  const handleHealthCheck = useCallback(async () => {
    addLog("info", "Checking /health...");
    try {
      const response = await fetch("/health");
      const data = await response.json();
      addLog("success", `Health: ${JSON.stringify(data)}`);
    } catch (err) {
      addLog("error", `Health check failed: ${err}`);
    }
  }, []);

  const handleDebug = useCallback(async () => {
    addLog("info", "Checking /debug...");
    try {
      const response = await fetch("/debug");
      const data = await response.json();
      addLog("success", `Debug: ${JSON.stringify(data)}`);
    } catch (err) {
      addLog("error", `Debug check failed: ${err}`);
    }
  }, []);

  return (
    <>
      <header className="header">
        <h1>RSC Service Worker</h1>
        <p>React Server Components in a Service Worker</p>
      </header>

      <StatusBar swStatus={swStatus} polyfillStatus={polyfillStatus} />

      <div className="card">
        <h2 className="card-title">🚀 Server Components</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <button
            className="btn"
            onClick={handleFetchRSC}
            disabled={swStatus !== "active" || polyfillStatus !== "ready"}
          >
            Fetch RSC
          </button>
          <button className="btn btn-secondary" onClick={handleRefresh}>
            Clear
          </button>
          <button className="btn btn-secondary" onClick={handleHealthCheck}>
            Health
          </button>
          <button className="btn btn-secondary" onClick={handleDebug}>
            Debug
          </button>
        </div>

        {error && <div className="error-message">❌ {error}</div>}

        <RSCLoader rscPromise={rscPromise} />
      </div>

      <LogViewer />

      <div className="card">
        <h2 className="card-title">💡 How RSC Works</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
          This demo renders React Server Components entirely in a Service Worker:
        </p>
        <div className="code-block">
          {`1. Main thread requests /rsc with Accept: text/x-component
2. Service worker renders React to RSC binary stream
3. Stream includes server component output + client refs
4. Main thread consumes stream via react-server-dom-webpack
5. Client components hydrate from webpack cache
6. Server actions POST back to /rsc for execution`}
        </div>
      </div>
    </>
  );
}

// Mount
createRoot(document.getElementById("root")!).render(<App />);
