# Incident War Room Implementation Task Pack

This folder is a handoff pack for another LLM/engineer.
Implement tasks in order unless blocked by dependency notes.

## Execution Order

1. [TASK-01 Package Skeleton](./TASK-01-package-skeleton.md)
2. [TASK-02 Vite + rsc-prism Wiring](./TASK-02-vite-rsc-prism.md)
3. [TASK-03 Runtime Bootstrap + Provider](./TASK-03-runtime-bootstrap.md)
4. [TASK-04 Domain Types + Seed](./TASK-04-domain-types-seed.md)
5. [TASK-05 Worker State Store](./TASK-05-worker-state-store.md)
6. [TASK-06 Worker Actions](./TASK-06-worker-actions.md)
7. [TASK-07 RSC Panels](./TASK-07-rsc-panels.md)
8. [TASK-08 Analytics Compute Worker](./TASK-08-analytics-worker.md)
9. [TASK-09 Analytics Bridge + Cache](./TASK-09-analytics-bridge.md)
10. [TASK-10 Main-Thread CPU Storm](./TASK-10-main-thread-storm.md)
11. [TASK-11 War Room Shell + Controls](./TASK-11-war-room-shell.md)
12. [TASK-12 Visual System (Ops Glass)](./TASK-12-visual-system.md)
13. [TASK-13 Stress + Tracing HUD](./TASK-13-stress-hud.md)
14. [TASK-14 Playwright Workflow Tests](./TASK-14-playwright-e2e.md)
15. [TASK-15 Vitest Browser Runtime Tests](./TASK-15-vitest-browser-runtime.md)
16. [TASK-16 Landing + Root Index Integration](./TASK-16-landing-integration.md)
17. [TASK-17 Vercel Single Build Integration](./TASK-17-vercel-build-integration.md)
18. [TASK-18 App README + Architecture Notes](./TASK-18-readme-architecture.md)

## Global Constraints

- Keep all RSC behavior validated via browser-runtime workflows.
- Do not use Node-only RSC condition hacks.
- Keep example self-contained; do not introduce shared app-shell abstractions.
- Keep deterministic behavior for seed data and stress harness.
- Use `200` responses for successful worker action acknowledgements (no 204/205/304).

## Completion Gate (Whole Pack)

- `pnpm --filter @examples/incident-war-room build`
- `pnpm --filter @examples/incident-war-room exec vitest run`
- `pnpm --filter @examples/incident-war-room exec playwright test`
