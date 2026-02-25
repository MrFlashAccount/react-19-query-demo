# TASK-01: Create Example Package Skeleton

## Size

S

## Goal

Create a standalone app package at `examples/incident-war-room` that compiles and runs.

## Files To Create

- `examples/incident-war-room/package.json`
- `examples/incident-war-room/tsconfig.json`
- `examples/incident-war-room/vite.config.ts`
- `examples/incident-war-room/index.html`
- `examples/incident-war-room/src/main.tsx`
- `examples/incident-war-room/src/App.tsx`
- `examples/incident-war-room/src/index.css`
- `examples/incident-war-room/tests/e2e/.gitkeep`
- `examples/incident-war-room/tests/unit/.gitkeep`

## Detailed Steps

1. Copy script style from `examples/movies-db/package.json`.
2. Use package name `@examples/incident-war-room`.
3. Add dependencies: `react`, `react-dom`, `@lib/rsc-prism`.
4. Add devDependencies: Vite + React plugin + TypeScript + Playwright + Vitest.
5. Create minimal app UI with title text only.
6. Ensure folder is valid pnpm workspace package.

## Definition Of Done (DoD)

- `pnpm --filter @examples/incident-war-room build` passes.
- `pnpm --filter @examples/incident-war-room dev` starts app.
- App loads without console errors.
