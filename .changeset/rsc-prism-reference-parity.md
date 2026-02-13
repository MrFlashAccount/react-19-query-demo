---
"@lib/rsc-prism": major
---

Align `@lib/rsc-prism` runtime behavior with the `rscexplorer` reference implementation.

### Breaking changes

- `createRSC` is now async and returns `Promise<CreateRSCResult<T>>`.
- `handleAction` now performs strict action ID lookup (no `module#export -> export` normalization).
- Flight serialization helpers now use `react-server-dom-webpack/server` rendering (`renderToReadableStream`) rather than custom protocol row generation.

### Other updates

- Local `react-server-dom-webpack` declaration file was expanded to match reference-style contracts (including `Thenable`-based client stream APIs).
- Flight serializer unit tests were updated for renderer-backed behavior.
- Browser-specific flight serializer tests are now skipped because server-writer rendering is not available in browser test runtime.
