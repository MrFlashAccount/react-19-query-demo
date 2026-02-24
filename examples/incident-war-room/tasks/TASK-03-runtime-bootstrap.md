# TASK-03: Runtime Bootstrap And Provider Integration

## Size
S

## Goal
Guarantee worker transport bootstraps before first RSC request.

## Depends On
- TASK-02

## Files To Modify

- `examples/incident-war-room/src/main.tsx`
- `examples/incident-war-room/src/App.tsx`

## Detailed Steps

1. Import `@lib/rsc-prism/polyfill` in `main.tsx`.
2. Render app with `StrictMode` + `Suspense`.
3. Wrap app in `RuntimeProvider` from `@lib/rsc-prism/react`.
4. Ensure first render path does not call `fetchRSC` before provider bootstrap.
5. Add fallback loader while bootstrap pending.

## Definition Of Done (DoD)

- No `Missing RSC transport` error on hard reload.
- No startup race where first request times out.
- Refresh + navigation keep stable behavior.
