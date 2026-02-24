# TASK-07: Build RSC Panels (Read Models)

## Size
M

## Goal
Render war-room panels from worker-side read models.

## Depends On
- TASK-06

## Files To Create

- `examples/incident-war-room/src/rsc/panels.tsx`

## Detailed Steps

1. Build panel worker components with `"use worker"`:
   - Incident Queue Panel
   - Topology Health Panel
   - Runbook Progress Panel
   - Timeline Panel
   - Risk Summary Panel
2. Wrap each panel via `rsc(...)` in client usage layer.
3. Ensure props are serializable and stable.
4. Support filtering (`service`, `severity`, `timeRange`).
5. Add empty and error states.

## Definition Of Done (DoD)

- All panels render via RSC worker path.
- Filter changes update panel output correctly.
- No direct main-thread render of worker refs.
