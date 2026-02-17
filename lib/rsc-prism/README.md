# @lib/rsc-prism

Environment-agnostic React Server Components primitives for browser-first runtimes.

This package focuses on:

- Streaming RSC payload transport
- Worker/message-based request handling
- Client/server action wiring for browser runtimes
- Vite transforms for `"use main"` / `"use client"` module proxying

## Breaking Changes (ESM-only runtime)

`rsc-prism` now uses an ESM-only RSC binding path.

- Removed webpack runtime shims and webpack cache/module registration behavior.
- Removed `react-server-dom-webpack` integration from runtime and plugin wiring.
- Client reference IDs are now normalized as ESM specifier IDs (for project files this is root-relative, e.g. `/src/file.tsx#Export`).
- Internal client manifest behavior now uses ESM base URL semantics.
- `./runtime/webpack-shim` export is removed.

Migration notes:

1. Stop importing any webpack shim/runtime helpers from `rsc-prism`.
2. Ensure your worker/main modules use plugin-generated references (`"use main"`, `"use client"`, `"use worker"`).
3. Keep browser-runtime tests as the source of truth for stream and action behavior.

## Flight Compliance Gaps (Current Runtime)

`@lib/rsc-prism` intentionally implements a custom browser-first Flight-like runtime, not full official React Flight wire compatibility.

Current known gaps:

1. Wire protocol rows are custom line-delimited records (`id:json\\n`) with custom deferred references (`{ "$t": "rowRef", "id": n }`).
2. Value serialization uses custom tagged wire values (for example `$t: "element"`, `$t: "clientRef"`, `$t: "serverRef"`) instead of official React Flight record encoding.
3. Action error payloads are runtime-specific records (`{ "__rscPrismError": true, ... }`) consumed by `@lib/rsc-prism/client`.
4. Client manifest support is ESM-focused and minimal (`id`, `name`, `chunks`, `async`) and does not implement official bundler/runtime record plumbing.
5. Module/chunk loading semantics remain plugin-managed ESM lookups (no webpack-style runtime requirements or official RSC module loader contract).
6. Compatibility guarantees apply to `@lib/rsc-prism` client/server pairs only; cross-runtime interop with other Flight implementations is not guaranteed.

Performance notes:

- Transport is stream-first (`head -> next* -> done`) and client parsing is incremental.
- Deferred row resolution is optimized to avoid full root graph re-checks for unrelated rows, but this is still a custom resolver path.

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
2. `bootstrapWorkerRuntime()` from `@lib/rsc-prism/client-only`
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
import { bootstrapWorkerRuntime, fetchRSC, callAction } from "@lib/rsc-prism/client-only";
import { increment } from "./todo-actions";

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
await bootstrapWorkerRuntime();
const tree = await fetchRSC("/rsc/view");
await callAction(increment, []);
```

`workerRuntime.entry`, `workerRuntime.servePath`, and `workerRuntime.fileName` are no longer supported; the plugin owns worker runtime generation, hashed asset naming, and virtual bootstrap internals.

## Experimental

Component-level worker directives are opt-in behind `experimental.componentLevelDirectives`.

```ts
import { defineConfig } from "vite";
import { rscPrism } from "@lib/rsc-prism/vite";

export default defineConfig({
  plugins: [
    rscPrism({
      workerRuntime: {
        enabled: true,
      },
      experimental: {
        componentLevelDirectives: true,
      },
    }),
  ],
});
```

When enabled, exported functions with leading `"use worker"` inside non-`"use worker"` modules are proxied as worker references (component-like exports) or action references (action-like exports). The generated virtual module exports only directive-marked exports; unmarked exports are intentionally omitted.
