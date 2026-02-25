# TASK-02: Wire Vite With rsc-prism Dual-Core Runtime

## Size

S

## Goal

Enable plugin-managed worker runtime and experimental batch refresh.

## Depends On

- TASK-01

## Files To Modify

- `examples/incident-war-room/vite.config.ts`

## Detailed Steps

1. Add `rscPrism` plugin from `@lib/rsc-prism/vite`.
2. Configure:
   - `workerRuntime: { enabled: true }`
   - `experimental.componentLevelDirectives: true`
   - `experimental.actionBatchRefresh: true`
3. Add alias `@` -> `src`.
4. Mirror proven config style from `examples/movies-db/vite.config.ts`.
5. Keep source maps off for parity with existing examples unless debugging required.

## Definition Of Done (DoD)

- Build emits worker runtime assets.
- App starts with plugin enabled and no runtime bootstrap errors.
- Future `"use worker"` exports are discoverable.
