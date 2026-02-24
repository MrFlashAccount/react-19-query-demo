# TASK-08: Analytics Compute Worker

## Size
M

## Goal
Implement second compute core for heavy risk analytics.

## Depends On
- TASK-04

## Files To Create

- `examples/incident-war-room/src/analytics/engine.worker.ts`
- `examples/incident-war-room/src/analytics/types.ts`

## Detailed Steps

1. Define worker message protocol:
   - request: `{ id, version, snapshot, mode }`
   - response: `{ id, version, result } | { id, version, error }`
2. Implement deterministic heavy compute:
   - blast radius traversal
   - correlation score per service
   - hotspot ranking
3. Keep algorithm deterministic by seed and stable iteration order.
4. Handle stale request cancellation/ignore logic by version.
5. Never block on synchronous giant loops without chunking strategy if needed.

## Definition Of Done (DoD)

- Same snapshot/version -> same result.
- Worker handles overlapping requests without mixing responses.
- Error path returns explicit error payload.
