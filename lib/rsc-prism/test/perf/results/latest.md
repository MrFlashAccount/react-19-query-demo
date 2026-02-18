# rsc-prism perf report

## Command

`RSC_PERF=1 RSC_PERF_ITERATIONS=8 RSC_PERF_ROW_COUNT=12000 RSC_PERF_CHUNK_SIZES=64,256,1024 RSC_PERF_BINARY_ROW_COUNT=4000 RSC_PERF_BINARY_ROW_BYTES=384 RSC_PERF_SERVER_ITEM_COUNT=1800 RSC_PERF_SERVER_ITEM_BYTES=384 pnpm --filter @lib/rsc-prism exec vitest run --project unit test/perf/flight-runtime.client-stream-perf.unit.test.ts test/perf/flight-runtime.decode-perf.unit.test.ts test/perf/flight-runtime.server-decode-reply-perf.unit.test.ts`

All numbers are medians of 3 consecutive runs.

## Baseline (before optimization)

- `synthetic-wire-decode`: `1.97ms`
- `synthetic-binary-wire-decode:rows=4000:bytes=384`: `1.90ms`
- `stream-parse+decode chunk=64`: `20.09ms`
- `stream-parse+decode chunk=256`: `15.10ms`
- `stream-parse+decode chunk=1024`: `12.58ms`
- `server-decodeReply`: `24.29ms`

## After optimization

- `synthetic-wire-decode`: `2.04ms`
- `synthetic-binary-wire-decode:rows=4000:bytes=384`: `1.61ms`
- `stream-parse+decode chunk=64`: `19.65ms`
- `stream-parse+decode chunk=256`: `14.56ms`
- `stream-parse+decode chunk=1024`: `12.63ms`
- `server-decodeReply`: `23.31ms`

## Delta (after - before)

- `synthetic-wire-decode`: `+0.07ms` (`+3.6%`, within noise)
- `synthetic-binary-wire-decode:rows=4000:bytes=384`: `-0.29ms` (`-15.3%`)
- `stream-parse+decode chunk=64`: `-0.44ms` (`-2.2%`)
- `stream-parse+decode chunk=256`: `-0.54ms` (`-3.6%`)
- `stream-parse+decode chunk=1024`: `+0.05ms` (`+0.4%`, within noise)
- `server-decodeReply`: `-0.98ms` (`-4.0%`)

## Changes

- **wire.ts**: Merged duplicate `encodeWireValue`/`encodeWireValueWithBinaryRows` into single `encodeWireValueImpl`. Removed `decodeTagValue` intermediate function. Replaced `createElement` with direct element construction. Removed defensive string coercions. `decodeBinaryWireRow` now returns final typed values directly (no wrapper objects).
- **client.ts**: Simplified row ID to numeric-only (removed string fallback). Removed dead binary-tag checks from `collectUnresolvedRowRefs`. Used `Object.keys` + indexed loop instead of `for-in` in scan. Direct binary row storage (no intermediate wrapper).
- **server.ts**: Added sync fast-path in `encodeServerNode` for arrays and props that avoids `Promise.all` when all children resolve synchronously.

## Deopt Sample (2026-02-18)

- Trace command wrapper: `pnpm --filter @lib/rsc-prism exec node test/perf/run-deopt-sample.mjs`
- Detailed report: `test/perf/results/deopt-sample-latest.md`
- Deopt events (all): `10`
- Deopt events (matched package functions): `0`
