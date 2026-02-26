# Agent Rules

## RSC Testing Runtime

1. React Server Components tests must be written as browser-runtime workflow tests that reflect real usage (rendering, actions, transport, request/response flows).
2. Do not rely on Node-only execution paths for RSC behavior validation.
3. Do not use `NODE_OPTIONS=--conditions=react-server` as a substitute for browser-runtime RSC test coverage.

## Self-Correction Rule

1. If the agent makes a mistake, it must add or update a rule in this file describing the correct behavior that prevents the same mistake.
2. The corrective rule must be specific, actionable, and tied to the failure mode that occurred.
3. After changing test/runtime config, the agent must validate direct package test execution with `pnpm --filter <pkg> exec vitest run` (without extra env flags), not only `package.json` script wrappers.
4. Default Vitest test suites must not include files that require server-only React conditions to import; such behavior must be covered through browser-runtime workflow tests instead.
5. Scenario/example apps used for browser integration coverage must be self-contained per scenario (own app + worker implementation) and must not rely on a shared generic app-shell abstraction.
6. When introducing library-managed runtime state consumed by both plugin-generated bootstrap modules and app imports, store the active runtime/transport on `globalThis` (not module-local variables) so behavior remains consistent even if Vite creates multiple module instances.
7. Do not store critical UI invalidation callbacks only in `WeakRef`; for deterministic refresh behavior, keep strong callback references and remove them explicitly on component unmount.
8. Suspense data loaders must not rely only on per-instance `useRef` caches for in-flight request deduplication; keep a stable cache outside component instance state (keyed by request identity) so pre-commit Suspense retries reuse the same promise and do not trigger infinite refetch loops.
9. Worker runtime bootstrap must not resolve before receiving explicit `rsc.prism.worker.ready` (or worker error/timeout); do not use short fallback timers that mark runtime ready early, because initial requests can be lost and later fail with transport timeouts.

## TypeScript

1. Use `@typescript/native-preview` and never `typescript` in package.json and pnpm catalog. All packages must depend on `@typescript/native-preview` for type checking and build tooling.
