# TASK-13: Stress And Tracing HUD

## Size
S

## Goal
Expose runtime proof that RSC flow stays usable under stress.

## Depends On
- TASK-10
- TASK-11

## Files To Create

- `examples/incident-war-room/src/components/StressHud.tsx`

## Detailed Steps

1. Show indicators:
   - active storm level
   - action latency
   - rerender/apply-batch latency
   - pending request count
2. Hook into tracing events where available.
3. Provide HUD show/hide toggle.
4. Keep HUD low-overhead.

## Definition Of Done (DoD)

- HUD metrics update in real time.
- Action execution produces visible timing deltas.
- Hiding HUD fully removes visual noise.
