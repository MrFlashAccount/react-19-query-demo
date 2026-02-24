# TASK-05: Worker Authoritative State Store

## Size
M

## Goal
Implement deterministic worker-side store with serialized mutation queue.

## Depends On
- TASK-04

## Files To Create

- `examples/incident-war-room/src/domain/store.ts`

## Detailed Steps

1. Keep state in module-local worker memory.
2. Expose APIs:
   - `getSnapshot()`
   - `applyMutation(fn)`
   - `getVersion()`
   - `resetStateForTests()` (optional)
3. Serialize writes via promise queue.
4. Clone or freeze snapshots to avoid external mutation.
5. Increment version once per committed mutation.

## Definition Of Done (DoD)

- Rapid concurrent action calls produce deterministic order.
- State never mutated outside queue path.
- Version monotonic and gap-free.
