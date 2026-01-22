/**
 * RSC Service Worker - Test Implementation
 *
 * Renders React Server Components in a service worker using a custom
 * Flight serializer that works in any JS environment.
 */
/// <reference lib="webworker" />

// Import webpack shim FIRST - required for client reference resolution
import "../rsc/webpack-shim";

import React from "react";
import { setupWorker, http, json } from "..";
import { buildClientManifest } from "../rsc/module-registry";
import {
  createFlightResponse,
  createServerAction,
  executeServerAction,
} from "../rsc/flight-serializer";
import type { ClientManifest } from "../rsc/types";

// ========== Server State ==========
let counter = 42;

// ========== Client Manifest ==========
const manifest: ClientManifest = buildClientManifest("client", [
  "Counter",
  "Button",
  "Toggle",
  "Card",
]);

// ========== Client Component Proxies ==========
function createClientRef(moduleId: string, exportName: string): React.ComponentType<any> {
  const ref = {
    $$typeof: Symbol.for("react.client.reference"),
    $$id: `${moduleId}#${exportName}`,
    name: exportName,
  };
  return ref as unknown as React.ComponentType<any>;
}

const Client = {
  Counter: createClientRef("client", "Counter"),
  Button: createClientRef("client", "Button"),
  Toggle: createClientRef("client", "Toggle"),
  Card: createClientRef("client", "Card"),
};

// ========== Server Actions ==========
// These are callable from client components via the RSC protocol

const incrementAction = createServerAction(
  "increment",
  async (currentCount: number): Promise<number> => {
    counter = currentCount + 1;
    console.log("[SW] Server Action: increment ->", counter);
    return counter;
  },
);

const decrementAction = createServerAction(
  "decrement",
  async (currentCount: number): Promise<number> => {
    counter = currentCount - 1;
    console.log("[SW] Server Action: decrement ->", counter);
    return counter;
  },
);

const resetAction = createServerAction("reset", async (): Promise<number> => {
  counter = 42;
  console.log("[SW] Server Action: reset ->", counter);
  return counter;
});

// ========== Server Components ==========

function ServerInfo({ time, random }: { time: string; random: string }) {
  return React.createElement(
    "div",
    {
      style: {
        background: "var(--bg-tertiary)",
        padding: "1rem",
        borderRadius: "8px",
        fontFamily: "monospace",
        fontSize: "0.9rem",
        marginBottom: "1rem",
      },
    },
    React.createElement("div", null, "📅 Server Time: ", time),
    React.createElement("div", null, "🔢 Random: ", random),
    React.createElement("div", null, "🌐 Rendered in: Service Worker"),
    React.createElement("div", null, "🔄 Server Counter: ", counter),
  );
}

function App() {
  const serverTime = new Date().toISOString();
  const randomValue = Math.random().toFixed(6);

  return React.createElement(
    "div",
    { style: { padding: "1rem" } },
    React.createElement(
      "h2",
      { style: { color: "var(--accent)", marginBottom: "1rem" } },
      "🎉 React Server Component!",
    ),
    React.createElement(
      "p",
      { style: { color: "var(--text-secondary)", marginBottom: "1rem" } },
      "This is a real RSC payload with server actions.",
    ),
    // Server component (rendered on SW)
    React.createElement(ServerInfo, { time: serverTime, random: randomValue }),
    // Client Counter - calls server actions via POST to /rsc
    React.createElement(Client.Counter, {
      initialCount: counter,
      actionEndpoint: "/rsc",
    }),
    // Card with nested client components
    React.createElement(
      Client.Card,
      { title: "Interactive Controls" },
      React.createElement(Client.Toggle, { label: "Dark Mode", defaultChecked: true }),
      React.createElement(
        "div",
        { style: { marginTop: "0.75rem", display: "flex", gap: "0.5rem" } },
        React.createElement(Client.Button, { variant: "primary" }, "Primary"),
        React.createElement(Client.Button, { variant: "secondary" }, "Secondary"),
      ),
    ),
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
    return createFlightResponse(React.createElement(App), manifest);
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
