# TASK-04: Domain Types And Deterministic Seed

## Size

M

## Goal

Define typed domain model and deterministic seed data for reproducible tests.

## Depends On

- TASK-01

## Files To Create

- `examples/incident-war-room/src/domain/types.ts`
- `examples/incident-war-room/src/domain/seed.ts`

## Detailed Steps

1. Define types:
   - `Incident`
   - `ServiceNode`
   - `RunbookStep`
   - `TimelineEvent`
   - `RiskSnapshot`
   - `WarRoomState`
2. Add seeded data generator using fixed RNG seed.
3. Keep stable sort order for arrays and IDs.
4. Include `stateVersion` numeric field for compute cache key.
5. Ensure data volume supports stress demo:
   - > = 30 incidents
   - > = 80 service nodes
   - > = 500 timeline events

## Definition Of Done (DoD)

- Running seed generation twice returns equal JSON snapshots.
- All fields typed, no `any`.
- Data covers at least 3 severity tiers and multiple assignees.
