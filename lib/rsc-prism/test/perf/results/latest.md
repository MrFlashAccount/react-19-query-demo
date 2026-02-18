# rsc-prism perf report

## Command

`RSC_PERF=1 RSC_PERF_ITERATIONS=8 RSC_PERF_ROW_COUNT=12000 RSC_PERF_CHUNK_SIZES=64,256,1024 RSC_PERF_BINARY_ROW_COUNT=4000 RSC_PERF_BINARY_ROW_BYTES=384 RSC_PERF_SERVER_ITEM_COUNT=1800 RSC_PERF_SERVER_ITEM_BYTES=384 pnpm --filter @lib/rsc-prism exec vitest run --project unit test/perf/flight-runtime.client-stream-perf.unit.test.ts test/perf/flight-runtime.decode-perf.unit.test.ts test/perf/flight-runtime.server-decode-reply-perf.unit.test.ts`

## Baseline (before optimization)

- `synthetic-wire-decode`: `2.94ms`
- `synthetic-binary-wire-decode:rows=4000:bytes=384`: `2.14ms`
- `stream-parse+decode chunk=64`: `20.52ms`
- `stream-parse+decode chunk=256`: `15.63ms`
- `stream-parse+decode chunk=1024`: `12.82ms`
- `server-decodeReply`: `27.22ms`

## After optimization

- `synthetic-wire-decode`: `2.60ms`
- `synthetic-binary-wire-decode:rows=4000:bytes=384`: `2.09ms`
- `stream-parse+decode chunk=64`: `20.19ms`
- `stream-parse+decode chunk=256`: `16.11ms`
- `stream-parse+decode chunk=1024`: `12.71ms`
- `server-decodeReply`: `23.76ms`

## Delta (after - before)

- `synthetic-wire-decode`: `-0.34ms` (`-11.56%`)
- `synthetic-binary-wire-decode:rows=4000:bytes=384`: `-0.05ms` (`-2.34%`)
- `stream-parse+decode chunk=64`: `-0.33ms` (`-1.61%`)
- `stream-parse+decode chunk=256`: `+0.48ms` (`+3.07%`)
- `stream-parse+decode chunk=1024`: `-0.11ms` (`-0.86%`)
- `server-decodeReply`: `-3.46ms` (`-12.71%`)

