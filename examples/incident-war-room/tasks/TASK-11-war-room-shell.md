# TASK-11: Build Single-Route War Room Shell

## Size
M

## Goal
Compose all panels and controls into one operator command view.

## Depends On
- TASK-07
- TASK-10

## Files To Modify/Create

- `examples/incident-war-room/src/App.tsx`
- `examples/incident-war-room/src/components/*` (new)

## Detailed Steps

1. Implement one route with dense dashboard layout.
2. Add controls:
   - severity filter
   - service filter
   - assignee control
   - storm level toggle
3. Add action affordances in queue panel rows.
4. Ensure each action triggers worker action only once per click.
5. Keep responsive layout for desktop + mobile.

## Definition Of Done (DoD)

- Operator can complete full incident flow from same page.
- Filters propagate to all relevant panels.
- No layout break at small viewport widths.
