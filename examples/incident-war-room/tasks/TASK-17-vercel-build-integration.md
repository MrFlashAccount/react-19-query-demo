# TASK-17: Integrate Into Single-Project Vercel Build

## Size

S

## Goal

Include new app in root build script and rewrite map.

## Depends On

- TASK-01
- TASK-16

## Files To Modify

- `scripts/build-vercel-single.mjs`
- `vercel.json`

## Detailed Steps

1. Build app with base `/incident-war-room/` in build script.
2. Copy dist into `dist/incident-war-room`.
3. Add rewrites:
   - `/incident-war-room`
   - `/incident-war-room/`
   - `/incident-war-room/:path((?!.*\.).*)`
4. Keep API/RSC rewrite style consistent with existing apps if endpoints added.

## Definition Of Done (DoD)

- `pnpm run build:vercel:single` includes app output.
- Generated `dist/incident-war-room/index.html` exists.
- Preview route fallback works for deep links.
