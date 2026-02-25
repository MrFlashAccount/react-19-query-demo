# TASK-10: Deterministic Main-Thread CPU Storm Harness

## Size

S

## Goal

Create reproducible UI stress load on main thread.

## Depends On

- TASK-01

## Files To Create

- `examples/incident-war-room/src/stress/mainThreadStorm.ts`

## Detailed Steps

1. Expose API:
   - `startStorm(level)`
   - `stopStorm()`
   - `setStormLevel(level)`
2. Levels: `off`, `low`, `med`, `high`.
3. Use deterministic compute kernel each frame/tick.
4. Ensure cleanup on unmount to prevent leaked timers.
5. Keep implementation simple and stable for tests.

## Definition Of Done (DoD)

- Storm level changes take effect in <= 1 second.
- Turning off storm clears all loops/timers.
- App still accepts action clicks under `med` load.
