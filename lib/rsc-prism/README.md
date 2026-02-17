# @lib/rsc-prism

Environment-agnostic React Server Components primitives for browser-first runtimes.

This package focuses on:

- Streaming RSC payload transport
- Worker/message-based request handling
- Client/server action wiring for browser runtimes
- Vite transforms for `"use main"` / `"use client"` module proxying

## Ultra-Small Use Cases for Auto Testing

The following micro apps are intentionally TodoMVC-scale (or smaller), deterministic, and suitable for automated tests.

### 1. Counter + History

- UI: current count, min/max/avg, last 5 operations
- Actions: `inc`, `dec`, `reset`
- Multi-core split: one worker lane mutates state, one computes derived stats

### 2. Mini Todo (3 filters)

- UI: todo list with `all` / `active` / `done`
- Actions: `addTodo`, `toggleTodo`, `clearDone`
- Multi-core split: filtering/counting in worker lane, action application in another lane

### 3. Tag Picker

- UI: selected tags + search input + sorted tag list
- Actions: `toggleTag`, `clearTags`
- Multi-core split: fuzzy match and stable sorting off main thread

### 4. Notes List (title only)

- UI: note titles + selected note preview
- Actions: `addNote`, `renameNote`, `deleteNote`
- Multi-core split: lightweight index rebuild separate from action mutation

### 5. Expense Sum

- UI: transactions, total sum, per-category totals
- Actions: `addTx`, `deleteTx`
- Multi-core split: aggregations computed in worker lane

### 6. Table Sort Demo

- UI: small table with sortable columns
- Actions: `setSort(column, direction)`
- Multi-core split: sorting and row streaming off main thread

## Standardized Test Contract

For all micro apps, keep the integration contract identical:

1. Read endpoint: `GET /rsc/view`
2. Action endpoint: `POST /rsc/action`
3. Fixed in-memory seed data only
4. Stable deterministic output order
5. Small action names (`inc`, `addTodo`, `setSort`, etc.)

## Required `rsc-prism` Primitives

Use plugin-managed worker runtime wiring:

1. `rscPrism()` with `workerRuntime.enabled: true`
2. `bootstrapWorkerRuntime()` from `virtual:rsc-prism/worker-bootstrap`
3. `fetchRSC`
4. `callAction`
5. Worker modules/actions discovered from local `"use worker"` exports

## Auto-Test Scenario Matrix

Use browser-runtime workflow tests for RSC behavior.

1. Render path: `fetchRSC("/rsc/view")` returns expected initial tree from seed data.
2. Mutation path: `callAction("/rsc/action", actionId, args)` updates state; next render reflects change.
3. Streaming path: worker transport produces `head -> next* -> done`.
4. Error path: unknown action ID returns controlled error response.
5. Timeout path: transport timeout surfaces deterministic failure state.
6. Responsiveness path: synthetic heavy worker compute does not block UI interaction.
7. Runtime path: no Node-only shortcuts for RSC validation; use browser-runtime workflows.

## Minimal Wiring Pattern

```ts
import { defineConfig } from "vite";
import { rscPrism } from "@lib/rsc-prism/vite";
import { bootstrapWorkerRuntime } from "virtual:rsc-prism/worker-bootstrap";
import { fetchRSC, callAction } from "@lib/rsc-prism/client-only";

export default defineConfig({
  plugins: [
    rscPrism({
      workerRuntime: {
        enabled: true,
      },
    }),
  ],
});

// Main thread app code
const runtime = await bootstrapWorkerRuntime();
const transport = runtime.transport;
const tree = await fetchRSC("/rsc/view", { transport });
await callAction("/rsc/action", "inc", [], { transport });
```

`workerRuntime.entry` is no longer supported; the plugin owns worker runtime generation and worker bootstrap details.
