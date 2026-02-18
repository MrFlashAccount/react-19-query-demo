# rsc-prism perf report

## Command

`RSC_PERF=1 RSC_PERF_ITERATIONS=8 RSC_PERF_ROW_COUNT=12000 RSC_PERF_CHUNK_SIZES=64,256,1024 RSC_PERF_BINARY_ROW_COUNT=4000 RSC_PERF_BINARY_ROW_BYTES=384 RSC_PERF_SERVER_ITEM_COUNT=1800 RSC_PERF_SERVER_ITEM_BYTES=384 pnpm --filter @lib/rsc-prism exec vitest run --project unit test/perf/flight-runtime.client-stream-perf.unit.test.ts test/perf/flight-runtime.decode-perf.unit.test.ts test/perf/flight-runtime.server-decode-reply-perf.unit.test.ts`

## Baseline (before optimization)

- `synthetic-wire-decode`: `2.68ms`
- `synthetic-binary-wire-decode:rows=4000:bytes=384`: `7.00ms`
- `stream-parse+decode chunk=64`: `21.00ms`
- `stream-parse+decode chunk=256`: `16.36ms`
- `stream-parse+decode chunk=1024`: `18.11ms`
- `server-decodeReply`: `28.49ms`

## After optimization

- `synthetic-wire-decode`: `3.37ms`
- `synthetic-binary-wire-decode:rows=4000:bytes=384`: `1.93ms`
- `stream-parse+decode chunk=64`: `20.98ms`
- `stream-parse+decode chunk=256`: `16.09ms`
- `stream-parse+decode chunk=1024`: `13.28ms`
- `server-decodeReply`: `25.80ms`

## Delta (after - before)

- `synthetic-wire-decode`: `+0.69ms` (`+25.75%`)
- `synthetic-binary-wire-decode:rows=4000:bytes=384`: `-5.07ms` (`-72.43%`)
- `stream-parse+decode chunk=64`: `-0.02ms` (`-0.10%`)
- `stream-parse+decode chunk=256`: `-0.27ms` (`-1.65%`)
- `stream-parse+decode chunk=1024`: `-4.83ms` (`-26.67%`)
- `server-decodeReply`: `-2.69ms` (`-9.44%`)

