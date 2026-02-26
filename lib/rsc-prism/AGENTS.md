# Agent Rules

1. Prefer mutations over immutable structures as much as possible.
2. In hot paths (wire parsing, transport handlers), avoid unnecessary allocations; prefer in-place mutation over creating new objects when safe.
3. Follow DRY practices: colocate related functions/classes, avoid duplications, keep files lean.
4. Keep public exports minimal; only expose what consumers need.

## Transport / Worker

1. When introducing library-managed runtime state consumed by both plugin-generated bootstrap modules and app imports, store the active runtime/transport on `globalThis` (not module-local variables) so behavior remains consistent even if Vite creates multiple module instances.
2. Worker runtime bootstrap must not resolve before receiving explicit `rsc.prism.worker.ready` (or worker error/timeout); do not use short fallback timers that mark runtime ready early, because initial requests can be lost and later fail with transport timeouts.

## Error Handling

1. On transport or wire errors, fail fast and surface clear errors rather than silently degrading or retrying indefinitely.

## Testing

1. RSC-related tests must run in the browser runtime; avoid Node-only RSC validation.
