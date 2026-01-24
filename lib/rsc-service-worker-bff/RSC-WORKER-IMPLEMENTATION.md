# React Server Components (RSC) in a Web Worker: Implementation Report

This report documents how React Server Components are configured and executed inside a Web Worker in this codebase. It extracts the reusable patterns and explains the core mechanisms, excluding the UI/rendering portions.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Dependencies](#core-dependencies)
3. [Polyfill (Safari Compatibility)](#polyfill-safari-compatibility)
4. [Webpack Shim](#webpack-shim)
5. [Server Worker Implementation](#server-worker-implementation)
6. [Client Worker Communication](#client-worker-communication)
7. [Code Compilation Pipeline](#code-compilation-pipeline)
8. [Module Registry](#module-registry)
9. [RSC (Flight) Protocol Parser](#rsc-flight-protocol-parser)
10. [Server Actions](#server-actions)
11. [Complete Reusable Code](#complete-reusable-code)
12. [Implementation Plan](#implementation-plan)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Main Thread                               │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────────┐  │
│  │   Compiler   │───▶│ WorkerClient │◀──▶│    Module Registry    │  │
│  │   (Babel)    │    │  (RPC layer) │    │  (webpack cache shim) │  │
│  └──────────────┘    └──────────────┘    └───────────────────────┘  │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │ postMessage
┌──────────────────────────────┼───────────────────────────────────────┐
│                              ▼               Web Worker              │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                      Worker Server                              │ │
│  │  ┌──────────────────────────────────────────────────────────┐   │ │
│  │  │ react-server-dom-webpack/server                          │   │ │
│  │  │  - renderToReadableStream()                              │   │ │
│  │  │  - registerServerReference()                             │   │ │
│  │  │  - createClientModuleProxy()                             │   │ │
│  │  │  - decodeReply()                                         │   │ │
│  │  └──────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

The system runs RSC logic entirely in a Web Worker, communicating with the main thread via `postMessage`. This enables:

- **Isolation**: Server code runs separately from client code
- **Streaming**: RSC payloads stream back chunk-by-chunk
- **Actions**: Server Actions are callable from the main thread

---

## Core Dependencies

```json
{
  "react": "^19.x",
  "react-server-dom-webpack": "^19.x",
  "@babel/standalone": "^7.x"
}
```

Key imports from `react-server-dom-webpack`:

```typescript
// Server-side (in worker)
import {
  renderToReadableStream,
  registerServerReference,
  createClientModuleProxy,
  decodeReply,
} from "react-server-dom-webpack/server";

// Client-side (main thread)
import { createFromReadableStream, encodeReply } from "react-server-dom-webpack/client";
```

---

## Polyfill (Safari Compatibility)

**Critical**: Safari doesn't implement `ReadableByteStreamController`. RSC streams will fail without this polyfill.

```typescript
// polyfill.ts - Import in BOTH worker and main thread

export const polyfillReady: Promise<void> =
  typeof globalThis.ReadableByteStreamController === "undefined"
    ? import("web-streams-polyfill").then(({ ReadableStream }) => {
        globalThis.ReadableStream = ReadableStream as typeof globalThis.ReadableStream;
      })
    : Promise.resolve();
```

**Usage pattern**: Always `await polyfillReady` before any RSC operations:

```typescript
// In worker - wait before signaling ready
polyfillReady.then(() => {
  self.postMessage({ type: "ready" });
});

// In client - wait before making requests
await Promise.all([this.readyPromise, polyfillReady]);
```

---

## Webpack Shim

RSC relies on webpack's module system internally. This minimal shim provides the required globals:

```typescript
// webpack-shim.ts - Must be imported BEFORE react-server-dom-webpack

const g = globalThis as Record<string, unknown>;

const moduleCache: Record<string, { exports?: unknown }> = {};

// Module cache storage
g.__webpack_module_cache__ = moduleCache;

// Module loader - retrieves modules from cache
g.__webpack_require__ = function (moduleId: string): unknown {
  const cached = moduleCache[moduleId];
  if (cached) return cached.exports ?? cached;
  throw new Error(`Module ${moduleId} not found`);
};

// Chunk loading - no-op for worker environment (everything already loaded)
g.__webpack_chunk_load__ = () => Promise.resolve();

// Export for module registry to use
export { moduleCache };
```

**Why this is needed**: `react-server-dom-webpack` internally calls these webpack globals when resolving client module references. Without this shim, RSC will throw runtime errors.

**Important**: The `moduleCache` export allows the module registry to add client modules that can be resolved during RSC consumption on the main thread.

---

## Server Worker Implementation

### Types

```typescript
// Encoded arguments for server action calls
export type EncodedArgs = {
  type: "formdata" | "string";
  data: string;
};

// Worker response messages
export type Response =
  | { type: "ready" }
  | { type: "next"; requestId: string; value: Uint8Array }
  | { type: "done"; requestId: string }
  | { type: "throw"; requestId: string; error: string; stack?: string };
```

### State Management

```typescript
type ServerModule = {
  default?: React.ComponentType | React.ReactNode;
  [key: string]: unknown; // Server action functions
};

// Deployed code and manifest
let deployed: { manifest: ClientManifest; module: ServerModule } | null = null;
```

### Stream Response Helper

Streams RSC output back to main thread chunk-by-chunk:

```typescript
async function sendStream(
  requestId: string,
  getStream: () => ReadableStream<Uint8Array> | Promise<ReadableStream<Uint8Array>>,
): Promise<void> {
  try {
    const stream = await getStream();
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      self.postMessage({ type: "next", requestId, value });
    }
    self.postMessage({ type: "done", requestId });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const msg: Response = { type: "throw", requestId, error: error.message };
    if (error.stack) msg.stack = error.stack;
    self.postMessage(msg);
  }
}
```

### Deploy Function

Loads compiled server code and registers server references:

```typescript
function deploy(
  compiledCode: string,
  manifest: ClientManifest,
  actionNames: string[],
): ReadableStream<Uint8Array> {
  // Create proxy for client module imports
  const clientModule = createClientModuleProxy("client");

  const modules: Record<string, unknown> = {
    react: React,
    "./client": clientModule, // Client components accessible via import
  };

  // Append server reference registration for each action
  let code = compiledCode;
  if (actionNames.length > 0) {
    code +=
      "\n" +
      actionNames
        .map(
          (name) =>
            `__registerServerReference(${name}, "${name}", "${name}"); exports.${name} = ${name};`,
        )
        .join("\n");
  }

  // Execute compiled code in isolated scope
  const module: { exports: ServerModule } = { exports: {} };
  const require = (id: string): unknown => {
    if (!modules[id]) throw new Error(`Module "${id}" not found`);
    return modules[id];
  };

  new Function("module", "exports", "require", "React", "__registerServerReference", code)(
    module,
    module.exports,
    require,
    React,
    registerServerReference,
  );

  deployed = { manifest, module: module.exports };
  return new ReadableStream({ start: (c) => c.close() });
}
```

**Key mechanisms**:

1. **`createClientModuleProxy("client")`** - Creates a Proxy that, when accessed, returns client reference descriptors. This is how the server knows about client components.

2. **`registerServerReference(fn, id, name)`** - Marks a function as a server action. React uses this metadata to enable calling the function from the client.

3. **Dynamic code execution** - Uses `new Function()` to execute compiled CommonJS code with injected dependencies.

### Render Function

Renders the deployed component to an RSC stream:

```typescript
function render(): ReadableStream<Uint8Array> {
  if (!deployed) throw new Error("No code deployed");
  const App = deployed.module.default as React.ComponentType;
  return renderToReadableStream(React.createElement(App), deployed.manifest, {
    onError: () => "Switch to dev mode to see full error.",
  });
}
```

**`renderToReadableStream(element, manifest, options)`** is the core RSC API:

- `element`: React element tree to serialize
- `manifest`: Maps client module IDs to their chunk locations
- Returns: `ReadableStream<Uint8Array>` of Flight protocol data

### Call Action Function

Executes a server action and returns the result as an RSC stream:

```typescript
async function callAction(
  actionId: string,
  encodedArgs: EncodedArgs,
): Promise<ReadableStream<Uint8Array>> {
  if (!deployed) throw new Error("No code deployed");
  if (!Object.hasOwn(deployed.module, actionId)) {
    throw new Error(`Action "${actionId}" not found`);
  }
  const actionFn = deployed.module[actionId] as Function;

  // Reconstruct FormData or string from encoded format
  let body: FormData | string;
  if (encodedArgs.type === "formdata") {
    body = new FormData();
    for (const [key, value] of new URLSearchParams(encodedArgs.data)) {
      body.append(key, value);
    }
  } else {
    body = encodedArgs.data;
  }

  // Decode React's wire format back to JS values
  const decoded = await decodeReply(body, {});
  const args = Array.isArray(decoded) ? decoded : [decoded];

  // Execute action and render result
  const result = await actionFn(...args);
  return renderToReadableStream(result, deployed.manifest);
}
```

**`decodeReply(body, manifest)`** - Deserializes action arguments from React's wire format (FormData or string) back into JavaScript values.

### Message Dispatcher

```typescript
self.onmessage = (
  event: MessageEvent<{
    requestId: string;
    method: "deploy" | "render" | "action";
    args: unknown[];
  }>,
) => {
  const req = event.data;
  switch (req.method) {
    case "deploy":
      sendStream(req.requestId, () => deploy(...req.args));
      break;
    case "render":
      sendStream(req.requestId, () => render(...req.args));
      break;
    case "action":
      sendStream(req.requestId, () => callAction(...req.args));
      break;
  }
};
```

---

## Client Worker Communication

The `WorkerClient` class provides a clean async API over worker postMessage:

```typescript
export function encodeArgs(encoded: FormData | string): EncodedArgs {
  if (encoded instanceof FormData) {
    return {
      type: "formdata",
      data: new URLSearchParams(encoded as unknown as Record<string, string>).toString(),
    };
  }
  return { type: "string", data: encoded };
}

export class WorkerClient {
  private worker: Worker;
  private requests = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
  private readyPromise: Promise<void>;
  private nextRequestId = 0;

  constructor(signal: AbortSignal) {
    this.worker = new Worker(workerUrl);

    const dispose = (reason: unknown) => {
      for (const controller of this.requests.values()) {
        controller.error(reason);
      }
      this.worker.terminate();
      this.requests.clear();
    };

    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      signal.addEventListener("abort", () => {
        reject(signal.reason);
        dispose(signal.reason);
      });
    });

    this.worker.onmessage = (msg) => this.handleMessage(msg);
    this.worker.onerror = (e) => dispose(e.error);
  }

  private handleMessage(event: MessageEvent<Response>): void {
    const msg = event.data;

    if (msg.type === "ready") {
      this.readyResolve();
      return;
    }

    const controller = this.requests.get(msg.requestId);
    if (!controller) throw new Error(`Unknown request: ${msg.requestId}`);

    switch (msg.type) {
      case "next":
        controller.enqueue(msg.value); // Stream chunk
        break;
      case "done":
        controller.close();
        this.requests.delete(msg.requestId);
        break;
      case "throw":
        const err = new Error(msg.error);
        if (msg.stack) err.stack = msg.stack;
        controller.error(err);
        this.requests.delete(msg.requestId);
        break;
    }
  }

  private async request(body: Record<string, unknown>): Promise<ReadableStream<Uint8Array>> {
    await this.readyPromise;
    const requestId = String(this.nextRequestId++);

    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c;
      },
    });

    this.requests.set(requestId, controller);
    this.worker.postMessage({ ...body, requestId });
    return stream;
  }

  // Public API
  deploy(code: string, manifest: ClientManifest, actions: string[]) {
    return this.request({ method: "deploy", args: [code, manifest, actions] });
  }

  render() {
    return this.request({ method: "render", args: [] });
  }

  callAction(actionId: string, args: EncodedArgs) {
    return this.request({ method: "action", args: [actionId, args] });
  }
}
```

**Key pattern**: Each request creates a `ReadableStream` with its controller stored in a map. Worker messages push data to the appropriate stream via the controller.

---

## Code Compilation Pipeline (Vite)

With Vite, compilation happens at **build time**, not runtime:

1. **JSX Transformation** - Vite + `@vitejs/plugin-react` handles this
2. **Module Bundling** - Vite bundles worker separately with `?worker` import
3. **Server Actions** - Defined statically in `actions.ts` and imported

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
    plugins: () => [react()], // Enable JSX in workers
  },
});
```

### Project Structure

```
src/
├── shared/
│   ├── webpack-shim.ts    # Must import first
│   ├── polyfill.ts        # Safari compatibility
│   └── manifest.ts        # Client component manifest
├── server/
│   ├── App.tsx            # Server components (bundled into worker)
│   └── actions.ts         # Server actions
├── worker/
│   └── rsc-worker.ts      # Worker entry (imports server code)
└── client/
    ├── rsc-client.ts      # Worker communication
    ├── module-registry.ts # Client module registration
    └── components.tsx     # Client components
```

### How It Works

1. **Server code** (`App.tsx`, `actions.ts`) is imported directly into `rsc-worker.ts`
2. **Vite bundles** the worker with all its dependencies
3. **Client imports** worker via `?worker` suffix - Vite handles URL
4. **No dynamic evaluation** - all code is statically compiled

### Build Client Manifest

Still needed - maps client component IDs to their modules:

```typescript
// src/shared/manifest.ts
export type ClientManifest = Record<string, { id: string; chunks: string[]; name: string }>;

export const clientManifest: ClientManifest = {
  client: { id: "client", chunks: [], name: "*" },
  "client#Counter": { id: "client", chunks: [], name: "Counter" },
  "client#Button": { id: "client", chunks: [], name: "Button" },
};
```

---

## Module Registry

Registers compiled client modules in the webpack shim:

```typescript
declare const __webpack_module_cache__: Record<string, { exports: unknown }>;

export function registerClientModule(moduleId: string, moduleExports: unknown): void {
  if (typeof __webpack_module_cache__ !== "undefined") {
    __webpack_module_cache__[moduleId] = { exports: moduleExports };
  }
}

export function evaluateClientModule(compiledCode: string): Record<string, unknown> {
  const module: { exports: Record<string, unknown> } = { exports: {} };
  const require = (id: string): unknown => {
    if (id === "react") return React;
    throw new Error(`Module "${id}" not found in client context`);
  };

  new Function("module", "exports", "require", "React", compiledCode)(
    module,
    module.exports,
    require,
    React,
  );

  return module.exports;
}
```

---

## RSC (Flight) Protocol Parser

The Flight protocol uses two framing modes:

1. **Text framing**: `ID:TAG DATA\n`
2. **Binary framing**: `ID:TAG HEX_LENGTH, BINARY_DATA` (no newline)

```typescript
// Tags that use binary (length-prefixed) framing
const BINARY_TAGS = new Set([
  0x54, // T - long text
  0x41, // A - ArrayBuffer
  0x4f, // O - Int8Array
  0x6f, // o - Uint8Array
  0x55, // U - Uint8ClampedArray
  0x53, // S - Int16Array
  0x73, // s - Uint16Array
  0x4c, // L - Int32Array
  0x6c, // l - Uint32Array
  0x47, // G - Float32Array
  0x67, // g - Float64Array
  0x4d, // M - BigInt64Array
  0x6d, // m - BigUint64Array
  0x56, // V - DataView
  0x62, // b - byte stream chunk
]);

export interface ParsedRow {
  id: string;
  segment: { type: "text" | "binary"; data: Uint8Array };
  raw: Uint8Array;
}

export function parseRows(
  buffer: Uint8Array,
  final: boolean = false,
): {
  rows: ParsedRow[];
  remainder: Uint8Array;
} {
  const rows: ParsedRow[] = [];
  let i = 0;

  while (i < buffer.length) {
    const rowStart = i;

    // Parse row ID (hex digits until ':')
    while (i < buffer.length && buffer[i] !== 0x3a) {
      if (!isHexDigit(buffer[i]!)) {
        throw new Error(`Expected hex digit in row ID`);
      }
      i++;
    }
    if (i >= buffer.length) {
      return { rows, remainder: buffer.slice(rowStart) };
    }

    const id = decodeAscii(buffer, rowStart, i);
    i++; // skip colon

    const tag = buffer[i]!;

    if (BINARY_TAGS.has(tag)) {
      // Binary: TAG + HEX_LENGTH + "," + DATA
      i++;
      let length = 0;
      while (i < buffer.length && buffer[i] !== 0x2c) {
        length = (length << 4) | hexValue(buffer[i]!);
        i++;
      }
      if (i >= buffer.length) return { rows, remainder: buffer.slice(rowStart) };
      i++; // skip comma

      if (i + length > buffer.length) {
        return { rows, remainder: buffer.slice(rowStart) };
      }

      const data = buffer.slice(i, i + length);
      const raw = buffer.slice(rowStart, i + length);
      rows.push({ id, segment: { type: "binary", data }, raw });
      i += length;
    } else {
      // Text: scan for newline
      const contentStart = i + 1;
      while (i < buffer.length && buffer[i] !== 0x0a) i++;
      if (i >= buffer.length && !final) {
        return { rows, remainder: buffer.slice(rowStart) };
      }

      const data = buffer.slice(contentStart, i);
      const raw = buffer.slice(rowStart, i + 1);
      rows.push({ id, segment: { type: "text", data }, raw });
      i++;
    }
  }

  return { rows, remainder: new Uint8Array(0) };
}
```

---

## Server Actions

### Registering Actions (Server Side)

```typescript
// During deploy, for each detected action:
registerServerReference(actionFn, "actionName", "actionName");
```

This attaches metadata to the function that React uses for identification.

### Calling Actions (Client Side)

```typescript
import { encodeReply } from "react-server-dom-webpack/client";

async function callServer(actionId: string, args: unknown[]): Promise<unknown> {
  // Encode arguments to React's wire format
  const encodedArgs = await encodeReply(args);

  // Send to worker
  const stream = await worker.callAction(actionId, encodeArgs(encodedArgs));

  // Parse RSC response
  return createFromReadableStream(stream, { callServer });
}
```

### Decoding Actions (Server Side)

```typescript
import { decodeReply } from "react-server-dom-webpack/server";

// In the worker:
const decoded = await decodeReply(body, {});
const args = Array.isArray(decoded) ? decoded : [decoded];
const result = await actionFn(...args);
```

---

## Complete Reusable Code

> **Note**: The Flight Protocol Parser (Section 9) is **optional**—it's only needed for debugging/visualization of RSC streams. The core functionality works without it.

### File 1: `webpack-shim.ts`

**Must be imported FIRST in both worker and main thread before any RSC imports.**

```typescript
// === webpack-shim.ts ===

const g = globalThis as Record<string, unknown>;
const moduleCache: Record<string, { exports?: unknown }> = {};

g.__webpack_module_cache__ = moduleCache;

g.__webpack_require__ = (id: string) => {
  const m = moduleCache[id];
  if (m) return m.exports ?? m;
  throw new Error(`Module ${id} not found`);
};

g.__webpack_chunk_load__ = () => Promise.resolve();

export { moduleCache };
```

### File 2: `polyfill.ts`

```typescript
// === polyfill.ts ===

export const polyfillReady: Promise<void> =
  typeof globalThis.ReadableByteStreamController === "undefined"
    ? import("web-streams-polyfill").then(({ ReadableStream }) => {
        globalThis.ReadableStream = ReadableStream as typeof globalThis.ReadableStream;
      })
    : Promise.resolve();
```

### File 3: `rsc-worker.ts` (Vite Static Build Version)

With Vite, server components are **pre-compiled and bundled** into the worker. No dynamic code evaluation needed.

```typescript
// === src/worker/rsc-worker.ts ===

import "../shared/webpack-shim"; // MUST be first!
import { polyfillReady } from "../shared/polyfill";
import React from "react";
import {
  renderToReadableStream,
  registerServerReference,
  decodeReply,
} from "react-server-dom-webpack/server";

// --- Static Imports (Vite bundles these at build time) ---
// App.tsx imports from './client.ts' which exports registerClientReference objects
import App from "../server/App";
import * as actions from "../server/actions";
import { clientManifest } from "../shared/manifest";

declare const self: DedicatedWorkerGlobalScope;

// --- Types ---

type EncodedArgs = {
  type: "formdata" | "string";
  data: string;
};

type Response =
  | { type: "ready" }
  | { type: "next"; requestId: string; value: Uint8Array }
  | { type: "done"; requestId: string }
  | { type: "throw"; requestId: string; error: string; stack?: string };

// --- Register Server Actions at Module Load ---

const actionRegistry: Record<string, Function> = {};

// Register all exported functions from actions.ts (except helpers)
for (const [name, fn] of Object.entries(actions)) {
  if (typeof fn === "function") {
    registerServerReference(fn, name, name);
    actionRegistry[name] = fn;
  }
}

// --- Stream Helper ---

async function sendStream(
  requestId: string,
  getStream: () => ReadableStream<Uint8Array> | Promise<ReadableStream<Uint8Array>>,
): Promise<void> {
  try {
    const stream = await getStream();
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      self.postMessage({ type: "next", requestId, value } satisfies Response);
    }
    self.postMessage({ type: "done", requestId } satisfies Response);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const msg: Response = { type: "throw", requestId, error: error.message };
    if (error.stack) msg.stack = error.stack;
    self.postMessage(msg);
  }
}

// --- Core Functions ---

function render(): ReadableStream<Uint8Array> {
  return renderToReadableStream(React.createElement(App), clientManifest, {
    onError: (err) => console.error("RSC render error:", err),
  });
}

async function callAction(
  actionId: string,
  encodedArgs: EncodedArgs,
): Promise<ReadableStream<Uint8Array>> {
  // Handle "module#export" format
  const actionName = actionId.split("#")[0] ?? actionId;

  const actionFn = actionRegistry[actionName];
  if (!actionFn) {
    throw new Error(
      `Action "${actionName}" not found. Available: ${Object.keys(actionRegistry).join(", ")}`,
    );
  }

  // Reconstruct body from encoded format
  let body: FormData | string;
  if (encodedArgs.type === "formdata") {
    body = new FormData();
    for (const [key, value] of new URLSearchParams(encodedArgs.data)) {
      body.append(key, value);
    }
  } else {
    body = encodedArgs.data;
  }

  // Decode with error handling
  let decoded;
  try {
    decoded = await decodeReply(body, {});
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to decode action arguments: ${msg}`);
  }

  const args = Array.isArray(decoded) ? decoded : [decoded];
  const result = await actionFn(...args);

  return renderToReadableStream(result, clientManifest);
}

// --- Message Dispatcher ---

self.onmessage = (
  event: MessageEvent<{
    requestId: string;
    method: "render" | "action";
    args: unknown[];
  }>,
) => {
  const req = event.data;
  switch (req.method) {
    case "render":
      sendStream(req.requestId, () => render());
      break;
    case "action":
      sendStream(req.requestId, () =>
        callAction(req.args[0] as string, req.args[1] as EncodedArgs),
      );
      break;
  }
};

// --- Initialization ---

polyfillReady.then(() => {
  self.postMessage({ type: "ready" } satisfies Response);
});
```

### File 3b: `App.tsx` (Server Component Example)

```typescript
// === src/server/App.tsx ===
import React from "react";
import { Counter } from "./client";  // Client component reference (proxy)

export default function App() {
  return (
    <div>
      <h1>RSC in Worker</h1>
      <p>This is a server component rendered in a Web Worker.</p>
      <Counter initialCount={0} />
    </div>
  );
}
```

### File 3c: `src/server/client.ts` (Client Component References)

This file exports client references that the server can use. With Vite, we create these references statically:

```typescript
// === src/server/client.ts ===
import { registerClientReference } from "react-server-dom-webpack/server";
import type { ComponentType } from "react";

// Type definitions for IDE support
type CounterProps = { initialCount: number };
type ButtonProps = { onClick: () => void; children: React.ReactNode };

// Create client references - these are placeholders that RSC serializes
// The actual components live on the main thread

function createClientRef<T>(name: string): T {
  const ref = Object.create(null);
  return registerClientReference(ref, "client", name) as T;
}

export const Counter = createClientRef<ComponentType<CounterProps>>("Counter");
export const Button = createClientRef<ComponentType<ButtonProps>>("Button");
```

**How client references work**:

1. `registerClientReference()` creates a special object with `$$typeof: Symbol(react.client.reference)`
2. When RSC serializes `<Counter />`, it outputs a reference to `"client#Counter"`
3. On the main thread, `__webpack_require__("client")` resolves to actual component
4. React hydrates the reference into the real component

### File 4: `rsc-client.ts` (Vite Static Build Version)

With Vite, no `deploy()` needed - server code is pre-bundled into the worker.

```typescript
// === src/client/rsc-client.ts ===

import "../shared/webpack-shim"; // MUST be first!
import { polyfillReady } from "../shared/polyfill";
import { createFromReadableStream, encodeReply } from "react-server-dom-webpack/client";

// --- Vite Worker Import ---
// This imports the worker and Vite handles bundling
import RscWorker from "../worker/rsc-worker?worker";

type EncodedArgs = {
  type: "formdata" | "string";
  data: string;
};

type Response =
  | { type: "ready" }
  | { type: "next"; requestId: string; value: Uint8Array }
  | { type: "done"; requestId: string }
  | { type: "throw"; requestId: string; error: string; stack?: string };

export function encodeArgs(encoded: FormData | string): EncodedArgs {
  if (encoded instanceof FormData) {
    return {
      type: "formdata",
      data: new URLSearchParams(encoded as unknown as Record<string, string>).toString(),
    };
  }
  return { type: "string", data: encoded };
}

export class RSCWorkerClient {
  private worker: Worker;
  private requests = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private nextRequestId = 0;

  constructor(signal?: AbortSignal) {
    // Vite handles worker URL
    this.worker = new RscWorker();

    const dispose = (reason: unknown) => {
      for (const controller of this.requests.values()) {
        controller.error(reason);
      }
      this.worker.terminate();
      this.requests.clear();
    };

    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      signal?.addEventListener("abort", () => {
        reject(signal.reason);
        dispose(signal.reason);
      });
    });

    this.worker.onmessage = (msg) => this.handleMessage(msg);
    this.worker.onerror = (e) => dispose(e.error);
  }

  private handleMessage(event: MessageEvent<Response>): void {
    const msg = event.data;

    if (msg.type === "ready") {
      this.readyResolve();
      return;
    }

    const controller = this.requests.get(msg.requestId);
    if (!controller) {
      console.warn(`Unknown request: ${msg.requestId}`);
      return;
    }

    switch (msg.type) {
      case "next":
        controller.enqueue(msg.value);
        break;
      case "done":
        controller.close();
        this.requests.delete(msg.requestId);
        break;
      case "throw": {
        const err = new Error(msg.error);
        if (msg.stack) err.stack = msg.stack;
        controller.error(err);
        this.requests.delete(msg.requestId);
        break;
      }
    }
  }

  private async request(body: Record<string, unknown>): Promise<ReadableStream<Uint8Array>> {
    await Promise.all([this.readyPromise, polyfillReady]);

    const requestId = String(this.nextRequestId++);
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c;
      },
    });

    this.requests.set(requestId, controller);
    this.worker.postMessage({ ...body, requestId });
    return stream;
  }

  // --- Public API (No deploy needed - everything pre-bundled) ---

  render(): Promise<ReadableStream<Uint8Array>> {
    return this.request({ method: "render", args: [] });
  }

  callAction(actionId: string, args: EncodedArgs): Promise<ReadableStream<Uint8Array>> {
    return this.request({ method: "action", args: [actionId, args] });
  }

  terminate(): void {
    this.worker.terminate();
  }
}

// --- Consuming RSC Streams ---

export function consumeRSCStream<T = unknown>(
  stream: ReadableStream<Uint8Array>,
  callServer?: (actionId: string, args: unknown[]) => Promise<unknown>,
): Promise<T> {
  return createFromReadableStream<T>(stream, callServer ? { callServer } : {});
}

// --- Helper for Server Actions ---

export function createCallServer(
  client: RSCWorkerClient,
): (actionId: string, args: unknown[]) => Promise<unknown> {
  const callServer = async (actionId: string, args: unknown[]): Promise<unknown> => {
    const encodedArgs = await encodeReply(args);
    const stream = await client.callAction(actionId, encodeArgs(encodedArgs));
    return consumeRSCStream(stream, callServer);
  };
  return callServer;
}
```

### File 5: `manifest.ts` (Static Build-Time Configuration)

Since Vite compiles everything at build time, you define the manifest statically:

```typescript
// === src/shared/manifest.ts ===

export type ClientManifest = Record<string, { id: string; chunks: string[]; name: string }>;

// Define your client component exports here
export const clientManifest: ClientManifest = {
  client: { id: "client", chunks: [], name: "*" },
  // Add each client component export:
  "client#Counter": { id: "client", chunks: [], name: "Counter" },
  "client#Button": { id: "client", chunks: [], name: "Button" },
};

// Helper to build manifest programmatically if needed
export function buildManifest(moduleId: string, exportNames: string[]): ClientManifest {
  const manifest: ClientManifest = {
    [moduleId]: { id: moduleId, chunks: [], name: "*" },
  };
  for (const name of exportNames) {
    manifest[`${moduleId}#${name}`] = { id: moduleId, chunks: [], name };
  }
  return manifest;
}
```

### File 5b: `actions.ts` (Server Actions Registry)

```typescript
// === src/server/actions.ts ===
"use server";

export async function incrementAction(count: number): Promise<number> {
  return count + 1;
}

export async function submitFormAction(formData: FormData): Promise<{ success: boolean }> {
  const name = formData.get("name");
  console.log("Received:", name);
  return { success: true };
}

// Export action names for registration
export const actionNames = ["incrementAction", "submitFormAction"] as const;
```

### File 6: `module-registry.ts`

```typescript
// === module-registry.ts ===

import React from "react";
import { moduleCache } from "./webpack-shim";

export function registerClientModule(moduleId: string, moduleExports: unknown): void {
  moduleCache[moduleId] = { exports: moduleExports };
}

export function evaluateClientModule(compiledCode: string): Record<string, unknown> {
  const module: { exports: Record<string, unknown> } = { exports: {} };
  const require = (id: string): unknown => {
    if (id === "react") return React;
    throw new Error(`Module "${id}" not found in client context`);
  };

  new Function("module", "exports", "require", "React", compiledCode)(
    module,
    module.exports,
    require,
    React,
  );

  return module.exports;
}
```

---

## Summary

| Component           | Purpose                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| **Webpack Shim**    | Provides `__webpack_require__` and `__webpack_module_cache__` globals       |
| **Worker Server**   | Executes `renderToReadableStream`, `registerServerReference`, `decodeReply` |
| **Worker Client**   | Converts postMessage to ReadableStreams                                     |
| **Compiler**        | Transforms JSX, ESM→CJS, detects `"use server"`                             |
| **Module Registry** | Registers client modules in webpack cache                                   |
| **Flight Parser**   | Parses RSC binary/text protocol for debugging                               |

The key insight: **RSC can run anywhere with proper webpack shims**. The actual server environment is simulated—no Node.js required. This enables RSC execution in:

- Web Workers (this implementation)
- Service Workers
- Browser main thread
- Edge runtimes

The minimal requirements are:

1. Webpack shim globals
2. `react-server-dom-webpack/server` for rendering
3. `react-server-dom-webpack/client` for consuming
4. A way to transport the byte stream between them

---

## Implementation Plan

> **Note**: This plan uses **Vite** for static compilation. No runtime Babel needed - all code is pre-compiled at build time.

### Phase 1: Project Setup

| Step | Action                             | Files                           |
| ---- | ---------------------------------- | ------------------------------- |
| 1.1  | Create new project with TypeScript | `package.json`, `tsconfig.json` |
| 1.2  | Install dependencies               | See below                       |
| 1.3  | Configure Vite for worker builds   | `vite.config.ts`                |

**package.json essentials**:

```json
{
  "type": "module",
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-server-dom-webpack": "^19.0.0",
    "web-streams-polyfill": "^4.0.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

**vite.config.ts**:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        worker: "src/worker/rsc-worker.ts",
      },
      output: {
        entryFileNames: (chunk) => {
          return chunk.name === "worker" ? "rsc-worker.js" : "[name]-[hash].js";
        },
      },
    },
  },
  worker: {
    format: "es",
  },
});
```

**Or simpler - use Vite's built-in worker support**:

```typescript
// In your main code, import worker like this:
import RscWorker from "./worker/rsc-worker.ts?worker";

const worker = new RscWorker();
```

### Phase 2: Core Infrastructure

| Step | Action                 | Output                       |
| ---- | ---------------------- | ---------------------------- |
| 2.1  | Create webpack shim    | `src/shared/webpack-shim.ts` |
| 2.2  | Create polyfill module | `src/shared/polyfill.ts`     |
| 2.3  | Create types file      | `src/shared/types.ts`        |

**Checklist**:

- [ ] `__webpack_module_cache__` global defined
- [ ] `__webpack_require__` global defined
- [ ] `__webpack_chunk_load__` global defined
- [ ] `polyfillReady` promise exported
- [ ] Shared types for `EncodedArgs`, `Response`, `ClientManifest`

### Phase 3: Worker Implementation

| Step | Action                          | Output                                |
| ---- | ------------------------------- | ------------------------------------- |
| 3.1  | Create worker entry point       | `src/worker/rsc-worker.ts`            |
| 3.2  | Implement `sendStream()` helper | Stream → postMessage bridge           |
| 3.3  | Implement `deploy()`            | Code loading + action registration    |
| 3.4  | Implement `render()`            | RSC stream generation                 |
| 3.5  | Implement `callAction()`        | Action execution + response           |
| 3.6  | Implement message dispatcher    | `self.onmessage` handler              |
| 3.7  | Add initialization handshake    | `polyfillReady` → `{ type: "ready" }` |

**Validation**:

- [ ] Worker loads without errors
- [ ] Worker sends "ready" message
- [ ] Worker handles unknown methods gracefully

### Phase 4: Client Implementation

| Step | Action                             | Output                             |
| ---- | ---------------------------------- | ---------------------------------- |
| 4.1  | Create `RSCWorkerClient` class     | `src/client/rsc-client.ts`         |
| 4.2  | Implement request/response mapping | `Map<requestId, StreamController>` |
| 4.3  | Implement `deploy()`               | Async deployment                   |
| 4.4  | Implement `render()`               | Returns `ReadableStream`           |
| 4.5  | Implement `callAction()`           | Returns `ReadableStream`           |
| 4.6  | Add `consumeRSCStream()` helper    | Stream → React elements            |
| 4.7  | Add `createCallServer()` helper    | For recursive action calls         |

**Validation**:

- [ ] Client waits for worker ready
- [ ] Client waits for polyfill ready
- [ ] Streams are properly closed on completion
- [ ] Errors propagate correctly

### Phase 5: Build-Time Setup (Vite)

Since Vite handles compilation, this phase is about **build configuration**, not runtime compilation.

| Step | Action                         | Output                              |
| ---- | ------------------------------ | ----------------------------------- |
| 5.1  | Configure Vite worker build    | `vite.config.ts`                    |
| 5.2  | Create server components file  | `src/server/App.tsx` (pre-compiled) |
| 5.3  | Export action names statically | `src/server/actions.ts`             |
| 5.4  | Create manifest at build time  | `src/shared/manifest.ts`            |

**Key difference**: Server code is bundled into the worker at build time. No dynamic code loading needed.

**Option A: Static server code in worker**

```typescript
// src/worker/rsc-worker.ts
import App from "../server/App";
import { incrementAction, submitAction } from "../server/actions";

// Actions registered at module load
const actions = { incrementAction, submitAction };
const actionNames = Object.keys(actions);

// Register all at startup
for (const [name, fn] of Object.entries(actions)) {
  registerServerReference(fn, name, name);
}
```

**Option B: Dynamic code loading (if needed)**

```typescript
// src/shared/manifest.ts
export const clientManifest = {
  client: { id: "client", chunks: [], name: "*" },
  "client#Counter": { id: "client", chunks: [], name: "Counter" },
};

// src/shared/actions.ts
export const serverActions = ["incrementAction", "submitAction"];
```

**Validation**:

- [ ] Worker builds successfully with Vite
- [ ] JSX transformed at build time
- [ ] Server actions exported and registered

### Phase 6: Module Registry

| Step | Action                             | Output                          |
| ---- | ---------------------------------- | ------------------------------- |
| 6.1  | Create module registry             | `src/client/module-registry.ts` |
| 6.2  | Implement `registerClientModule()` | Add to webpack cache            |
| 6.3  | Implement `evaluateClientModule()` | Execute compiled code           |

**Validation**:

- [ ] Client modules accessible via `__webpack_require__`
- [ ] Modules receive React as dependency

### Phase 7: Integration Testing

```typescript
// === Example test flow (Vite) ===
import {
  RSCWorkerClient,
  consumeRSCStream,
  createCallServer,
  encodeArgs,
} from "./client/rsc-client";
import { registerClientModule } from "./client/module-registry";
import * as ClientComponents from "./client/components";

// 1. Register client components
registerClientModule("client", ClientComponents);

// 2. Create client (worker is pre-bundled by Vite)
const client = new RSCWorkerClient();
const callServer = createCallServer(client);

// 3. Render
const stream = await client.render();
const result = await consumeRSCStream(stream, callServer);
console.log("Rendered:", result);

// 4. Call action
import { encodeReply } from "react-server-dom-webpack/client";
const actionArgs = await encodeReply([42]);
const actionStream = await client.callAction("incrementAction", encodeArgs(actionArgs));
const actionResult = await consumeRSCStream(actionStream, callServer);
console.log("Action result:", actionResult);
```

**Test Cases**:

- [ ] Worker loads and sends "ready"
- [ ] Simple component renders
- [ ] Nested components render
- [ ] Client component references resolve
- [ ] Server action can be called
- [ ] Server action returns correct result
- [ ] Streaming works (multiple chunks)
- [ ] Errors propagate correctly
- [ ] Safari polyfill works
- [ ] Vite HMR works in dev mode

### Phase 8: Optional Enhancements

| Enhancement             | Description                                  |
| ----------------------- | -------------------------------------------- |
| Flight Parser           | Parse RSC protocol for debugging (Section 9) |
| Multiple client modules | Support `"./moduleA"`, `"./moduleB"`         |
| Hot reloading           | Re-deploy without full reload                |
| Action caching          | Cache action results                         |
| Error boundaries        | Graceful error UI                            |

---

## Quick Start Template

```bash
# 1. Create project
mkdir my-rsc-worker && cd my-rsc-worker
npm init -y

# 2. Install deps
npm install react react-dom react-server-dom-webpack web-streams-polyfill
npm install -D vite @vitejs/plugin-react typescript @types/react

# 3. Create directory structure
mkdir -p src/{shared,worker,server,client}

# 4. Create files from Section 11:
# - src/shared/webpack-shim.ts
# - src/shared/polyfill.ts
# - src/shared/manifest.ts
# - src/worker/rsc-worker.ts
# - src/server/App.tsx
# - src/server/actions.ts
# - src/client/rsc-client.ts
# - src/client/module-registry.ts
# - vite.config.ts

# 5. Run dev server
npm run dev
```

**vite.config.ts**:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
    plugins: () => [react()],
  },
});
```

**Example main.tsx**:

```typescript
import { RSCWorkerClient, consumeRSCStream, createCallServer } from "./client/rsc-client";
import { registerClientModule } from "./client/module-registry";
import * as ClientComponents from "./client/components"; // Your client components

// Register client components in webpack cache
registerClientModule("client", ClientComponents);

async function main() {
  const client = new RSCWorkerClient();
  const callServer = createCallServer(client);

  // Render initial RSC
  const stream = await client.render();
  const result = await consumeRSCStream(stream, callServer);

  console.log("RSC Result:", result);
  // Use with React: root.render(use(result))
}

main();
```

---

## Gaps Fixed in This Report

| Issue                                    | Fix                                    |
| ---------------------------------------- | -------------------------------------- |
| Missing Safari polyfill                  | Added Section 3 + polyfill in all code |
| Incomplete minimal worker                | Full working version in Section 11     |
| Missing `readyResolve` declaration       | Added to `RSCWorkerClient`             |
| Buggy require function                   | Removed - Vite handles bundling        |
| Missing action ID split on `#`           | Added to `callAction()`                |
| Missing `createFromReadableStream` usage | Added `consumeRSCStream()` helper      |
| Flight Parser presented as required      | Clarified it's optional                |
| No implementation plan                   | Added Phase 1-8 with checklist         |
| Runtime Babel compilation                | Replaced with Vite static build        |
| Dynamic code deployment                  | Replaced with static imports           |
| No Vite config example                   | Added `vite.config.ts`                 |
| No example App component                 | Added `App.tsx` example                |
