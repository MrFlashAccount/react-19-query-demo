# TASK-09: Analytics Bridge, Cache, And In-Flight Dedupe

## Size
M

## Goal
Connect state snapshots to analytics worker with versioned caching.

## Depends On
- TASK-05
- TASK-08

## Files To Create

- `examples/incident-war-room/src/analytics/bridge.ts`

## Detailed Steps

1. Instantiate analytics worker.
2. Provide `getRiskSnapshot(version, snapshot)` API.
3. Add cache map keyed by `version`.
4. Add in-flight promise dedupe keyed by `version`.
5. Add timeout handling and fallback risk snapshot.
6. Ensure stale compute responses do not override newer version data.

## Definition Of Done (DoD)

- No duplicate compute for same version.
- Cache invalidates naturally on version change.
- Timeout/failure gives deterministic fallback object.
