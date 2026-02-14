# RSC TodoMVC Integration App

Self-contained Vite SPA scenario for `@lib/rsc-prism` browser-runtime integration.

## Run

From repository root:

```bash
pnpm --filter @lib/rsc-prism exec vite --config test/integration/TodoMVC/vite.config.ts
```

Then open the dev URL printed by Vite.

## Build

```bash
pnpm --filter @lib/rsc-prism exec vite build --config test/integration/TodoMVC/vite.config.ts
```

## Contract

- Read endpoint: `GET /rsc/view`
- Worker runtime bootstrap: `bootstrapWorkerRuntime()` from `virtual:rsc-prism/worker-bootstrap`
- Worker transport wiring is plugin-generated in this scenario
- Worker action registration is plugin-generated from function-level `"use worker"` exports
