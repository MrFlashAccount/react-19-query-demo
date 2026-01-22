/**
 * RSC Service Worker - Test Implementation
 *
 * Renders React Server Components in a service worker using
 * react-server-dom-webpack for proper RSC serialization.
 */
/// <reference lib="webworker" />

// Import webpack shim FIRST - required for react-server-dom-webpack
import "../rsc/webpack-shim";

import { setupWorker, http, json, createRSC } from "..";

// Import types from client components for type-safe proxy
import type * as ClientComponents from "./components";

// ========== Server State ==========
let counter = 42;

// ========== Setup RSC ==========
// Creates context, client proxy, and registers actions all at once
const { ctx, Client, ready } = createRSC<typeof ClientComponents>({
  moduleId: "client",
  components: ["Counter", "Button", "Toggle", "Card"],
  actions: {
    async increment(currentCount) {
      counter = (currentCount as number) + 1;
      console.log("[SW] Server Action: increment ->", counter);
      return counter;
    },
    async decrement(currentCount) {
      counter = (currentCount as number) - 1;
      console.log("[SW] Server Action: decrement ->", counter);
      return counter;
    },
    async reset() {
      counter = 42;
      console.log("[SW] Server Action: reset ->", counter);
      return counter;
    },
  },
});

// ========== Server Components ==========

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
  http.get("/health", () => json({ status: "ok", timestamp: Date.now(), counter })),
  http.rsc("/rsc", () => <App />, ctx, { ready }),
  http.action("/rsc", ctx, { ready }),
  http.get("/debug", async () => {
    await ready;
    return json({
      environment: "service-worker",
      counter,
      manifest: Object.keys(ctx.manifest),
      actions: Array.from(ctx.actions.keys()),
    });
  }),
]);

console.log("[SW] Routes registered");
