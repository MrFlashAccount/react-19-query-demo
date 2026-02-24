# TASK-14: Playwright Browser Workflow Tests

## Size
M

## Goal
Validate real user flows and transport stability in browser runtime.

## Depends On
- TASK-11
- TASK-13

## Files To Create

- `examples/incident-war-room/playwright.config.ts`
- `examples/incident-war-room/tests/e2e/war-room.spec.ts`

## Detailed Steps

1. Add app boot smoke test.
2. Add action flow tests for all key actions.
3. Add filter propagation test.
4. Add stress-on test: run storm + execute actions.
5. Add console/runtime error guard for worker reference errors.
6. Add trace-based assertion (action parent -> rerender spans) if tracing exposed.

## Definition Of Done (DoD)

- `pnpm --filter @examples/incident-war-room exec playwright test` passes.
- No worker runtime reference errors in test logs.
- At least one test proves actions succeed under stress.
