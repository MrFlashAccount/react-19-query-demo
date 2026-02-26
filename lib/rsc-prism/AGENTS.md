# Agent Rules

1. Prefer mutations over immutable structures as much as possible.
2. In hot paths (wire parsing, transport handlers), avoid unnecessary allocations; prefer in-place mutation over creating new objects when safe.
3. Follow DRY practices: colocate related functions/classes, avoid duplications, keep files lean.
4. Keep public exports minimal; only expose what consumers need.

## Monomorphism

5. Preserve monomorphic shapes: avoid optional fields in internal APIs (public API may use them); avoid optional callbacks—prefer a noop function as default so call sites never need optional chaining; eliminate optional chaining as much as possible.
6. Avoid object shape changes and the `delete` keyword so V8 hidden classes remain stable.

## Allocations / Cloning

1. Avoid cloning; prefer in-place mutation. Do not use `JSON.stringify`/`JSON.parse` for deep cloning or as a structural key when a cheaper alternative exists. Wire-format serialization (Flight protocol) is exempt.

## Transport / Worker

1. When introducing library-managed runtime state consumed by both plugin-generated bootstrap modules and app imports, store the active runtime/transport on `globalThis` (not module-local variables) so behavior remains consistent even if Vite creates multiple module instances.
2. Worker runtime bootstrap must not resolve before receiving explicit `rsc.prism.worker.ready` (or worker error/timeout); do not use short fallback timers that mark runtime ready early, because initial requests can be lost and later fail with transport timeouts.

## Error Handling

1. On transport or wire errors, fail fast and surface clear errors rather than silently degrading or retrying indefinitely.

## Testing

1. RSC-related tests must run in the browser runtime; avoid Node-only RSC validation.

## JSDoc

1. Prefer "why" over "what": explain rationale, design decisions, and constraints rather than restating the code.
2. Add module-level JSDoc for non-trivial modules: purpose, entry points, and how pieces fit together.
3. Document public functions with a one-line summary; add `@param` / `@returns` only when types or behavior are non-obvious.
4. Avoid redundant descriptions (e.g. "Returns the value" for a getter); focus on edge cases, invariants, or performance implications.
