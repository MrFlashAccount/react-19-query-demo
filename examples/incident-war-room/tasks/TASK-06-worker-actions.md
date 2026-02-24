# TASK-06: Implement Worker Actions (`use worker`)

## Size
M

## Goal
Create mutation actions for incident lifecycle and operator workflow.

## Depends On
- TASK-05

## Files To Create

- `examples/incident-war-room/src/rsc/actions.ts`

## Detailed Steps

1. Export each action with function-level `"use worker"`:
   - `ackIncident`
   - `assignIncident`
   - `changeSeverity`
   - `runMitigation`
   - `resolveIncident`
2. Validate action input shape and entity existence.
3. Update state via store queue only.
4. Append timeline entries for each action.
5. Return small result payload (`ok`, `incidentId`, `newStatus`, `message`).
6. Throw controlled errors for invalid input.

## Definition Of Done (DoD)

- Each action changes expected fields.
- Invalid IDs and invalid transitions produce controlled failures.
- Actions safe under burst calls.
