/**
 * RSC Service Worker - Test Implementation
 *
 * Renders React Server Components in a service worker using a custom
 * Flight serializer that works in any JS environment.
 */
/// <reference lib="webworker" />

// Import webpack shim FIRST - required for client reference resolution
import "../rsc/webpack-shim";

import { setupWorker, http, json, createClientModule } from "..";
import {
  createFlightResponse,
  createServerAction,
  executeServerAction,
} from "../rsc/flight-serializer";

// Import types from client components for type-safe references
import type * as ClientComponents from "./components";

// ========== Server State ==========
let counter = 42;

// ========== Create Client Module ==========
// This gives us:
// - manifest: for RSC serialization
// - refs (Client): typed component proxies for JSX
const { manifest, refs: Client } = createClientModule<typeof ClientComponents>("client", [
  "Counter",
  "Button",
  "Toggle",
  "Card",
]);

// ========== Server Actions ==========
// These are callable from client components via the RSC protocol

createServerAction("increment", async (currentCount: number): Promise<number> => {
  counter = currentCount + 1;
  console.log("[SW] Server Action: increment ->", counter);
  return counter;
});

createServerAction("decrement", async (currentCount: number): Promise<number> => {
  counter = currentCount - 1;
  console.log("[SW] Server Action: decrement ->", counter);
  return counter;
});

createServerAction("reset", async (): Promise<number> => {
  counter = 42;
  console.log("[SW] Server Action: reset ->", counter);
  return counter;
});

// ========== Server Components ==========
// These are pure React components that render on the service worker.
// They can use async/await, access server state, and compose client components.

function ServerInfo({ time, random }: { time: string; random: string }) {
  return (
    <div
      style={{
        background: "var(--bg-tertiary)",
        padding: "1rem",
        borderRadius: "8px",
        fontFamily: "monospace",
        fontSize: "0.9rem",
        marginBottom: "1rem",
      }}
    >
      <div>📅 Server Time: {time}</div>
      <div>🔢 Random: {random}</div>
      <div>🌐 Rendered in: Service Worker</div>
      <div>🔄 Server Counter: {counter}</div>
    </div>
  );
}

function App() {
  const serverTime = new Date().toISOString();
  const randomValue = Math.random().toFixed(6);

  return (
    <div style={{ padding: "1rem" }}>
      <h2 style={{ color: "var(--accent)", marginBottom: "1rem" }}>🎉 React Server Component!</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
        This is a real RSC payload with server actions.
      </p>

      {/* Server component - rendered on SW */}
      <ServerInfo time={serverTime} random={randomValue} />

      {/* Client Counter - calls server actions via POST to /rsc */}
      <Client.Counter initialCount={counter} actionEndpoint="/rsc" />

      {/* Card with nested client components */}
      <Client.Card title="Interactive Controls">
        <Client.Toggle label="Dark Mode" defaultChecked />
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
          <Client.Button variant="primary">Primary</Client.Button>
          <Client.Button variant="secondary">Secondary</Client.Button>
        </div>
      </Client.Card>
    </div>
  );
}

// ========== Setup Routes ==========
setupWorker([
  // Health check
  http.get("/health", () =>
    json({
      status: "ok",
      timestamp: Date.now(),
      counter,
    }),
  ),

  // RSC endpoint - returns RSC stream
  http.get("/rsc", () => {
    console.log("[SW] Rendering RSC stream...");
    return createFlightResponse(<App />, manifest);
  }),

  // Server action endpoint - handles action invocations from client
  http.post("/rsc", async ({ request }) => {
    const actionId = request.headers.get("x-rsc-action");
    if (!actionId) {
      return json({ error: "Missing x-rsc-action header" }, { status: 400 });
    }

    console.log("[SW] Executing server action:", actionId);

    // Parse args from request body
    const body = await request.text();
    let args: unknown[] = [];
    try {
      // The client sends args encoded as JSON array
      args = JSON.parse(body);
      if (!Array.isArray(args)) args = [args];
    } catch {
      // If not JSON, treat as single string arg
      args = body ? [body] : [];
    }

    return executeServerAction(actionId, args, manifest);
  }),

  // Debug endpoint
  http.get("/debug", () =>
    json({
      environment: "service-worker",
      counter,
      manifest: Object.keys(manifest),
      actions: ["increment", "decrement", "reset"],
    }),
  ),
]);

console.log("[SW] Routes registered");
