# TASK-15: Vitest Browser-Runtime Integration Tests

## Size
S

## Goal
Add deterministic browser-runtime tests for RSC render/action contracts.

## Depends On
- TASK-07

## Files To Create

- `examples/incident-war-room/vitest.config.ts`
- `examples/incident-war-room/tests/unit/rsc-workflow.browser.test.ts`

## Detailed Steps

1. Configure Vitest for browser runtime path for this app.
2. Add tests for:
   - initial RSC render
   - action mutation then rerender
   - controlled error on invalid action
3. Keep tests aligned with browser workflow model, not Node shortcuts.

## Definition Of Done (DoD)

- `pnpm --filter @examples/incident-war-room exec vitest run` passes.
- Tests do not require `NODE_OPTIONS=--conditions=react-server`.
- Failures are deterministic and actionable.
