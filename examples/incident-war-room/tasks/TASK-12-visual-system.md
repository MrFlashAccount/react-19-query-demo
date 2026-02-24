# TASK-12: Visual System (High-Contrast Ops Glass)

## Size
M

## Goal
Deliver distinctive flagship visuals, not boilerplate dashboard styling.

## Depends On
- TASK-11

## Files To Modify

- `examples/incident-war-room/src/index.css`
- `examples/incident-war-room/src/components/*` styles as needed

## Detailed Steps

1. Define CSS custom properties for colors, borders, glow, depth.
2. Build layered background (gradient + subtle grid/pattern).
3. Use glass cards with controlled blur/transparency.
4. Add meaningful motion:
   - staged panel reveal
   - status pulse for active incidents
   - muted transitions for filter changes
5. Keep text contrast high and hierarchy obvious.

## Definition Of Done (DoD)

- UI has clear unique visual direction.
- Key content readable in all states.
- Animations do not reduce usability under load.
