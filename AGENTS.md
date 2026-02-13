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
5. When using `createWorkerTransportMessageHandler`, do not return `204`/`205`/`304` responses from worker handlers; use a `200` response for successful action acknowledgements because worker transport reconstructs a streamed `Response` body on the client.
6. Scenario/example apps used for browser integration coverage must be self-contained per scenario (own app + worker implementation) and must not rely on a shared generic app-shell abstraction.
