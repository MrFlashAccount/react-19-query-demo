# Perf Tests

This folder contains runtime perf harnesses for `@lib/rsc-prism`.

## What is measured

- `flight-runtime.client-stream-perf.unit.test.ts`
  - stream parse + decode over row payloads
  - reports root-scan and decode sub-metrics
- `flight-runtime.decode-perf.unit.test.ts`
  - wire decode on synthetic object-heavy and binary-heavy payloads
- `flight-runtime.server-decode-reply-perf.unit.test.ts`
  - server `decodeReply` for large binary `FormData` payloads

## Run all perf tests

From repo root:

```bash
RSC_PERF=1 pnpm --filter @lib/rsc-prism exec vitest run --project unit test/perf/flight-runtime.client-stream-perf.unit.test.ts test/perf/flight-runtime.decode-perf.unit.test.ts test/perf/flight-runtime.server-decode-reply-perf.unit.test.ts
```

`RSC_PERF=1` is required. without it, perf tests are skipped.

## Recommended profiles

Use same profile for before/after comparisons.

### Typical profile (default for day-to-day checks)

```bash
RSC_PERF=1 \
RSC_PERF_ITERATIONS=12 \
RSC_PERF_ROW_COUNT=2000 \
RSC_PERF_CHUNK_SIZES=128,256,1024 \
RSC_PERF_BINARY_ROW_COUNT=600 \
RSC_PERF_BINARY_ROW_BYTES=256 \
RSC_PERF_SERVER_ITEM_COUNT=500 \
RSC_PERF_SERVER_ITEM_BYTES=256 \
pnpm --filter @lib/rsc-prism exec vitest run --project unit test/perf/flight-runtime.client-stream-perf.unit.test.ts test/perf/flight-runtime.decode-perf.unit.test.ts test/perf/flight-runtime.server-decode-reply-perf.unit.test.ts
```

### Stress profile (regression guardrail)

```bash
RSC_PERF=1 \
RSC_PERF_ITERATIONS=8 \
RSC_PERF_ROW_COUNT=12000 \
RSC_PERF_CHUNK_SIZES=64,256,1024 \
RSC_PERF_BINARY_ROW_COUNT=4000 \
RSC_PERF_BINARY_ROW_BYTES=384 \
RSC_PERF_SERVER_ITEM_COUNT=1800 \
RSC_PERF_SERVER_ITEM_BYTES=384 \
pnpm --filter @lib/rsc-prism exec vitest run --project unit test/perf/flight-runtime.client-stream-perf.unit.test.ts test/perf/flight-runtime.decode-perf.unit.test.ts test/perf/flight-runtime.server-decode-reply-perf.unit.test.ts
```

## Env vars

- `RSC_PERF`: enable perf tests (`1`)
- `RSC_PERF_ITERATIONS`: benchmark loop count
- `RSC_PERF_ROW_COUNT`: row count for stream payload benchmark
- `RSC_PERF_CHUNK_SIZES`: comma-separated chunk sizes for stream test
- `RSC_PERF_BINARY_ROW_COUNT`: rows in synthetic binary wire benchmark
- `RSC_PERF_BINARY_ROW_BYTES`: byte width per binary row
- `RSC_PERF_SERVER_ITEM_COUNT`: items in server `decodeReply` benchmark payload
- `RSC_PERF_SERVER_ITEM_BYTES`: byte width per server benchmark item
- `RSC_WIRE_FILE` (optional): JSON file for custom wire decode benchmark
- `RSC_FLIGHT_FILE` (optional): text file for custom flight parse+decode benchmark

## Result logging

- Use `test/perf/results/latest.md` for before/after snapshots.
- Always record:
  - exact command
  - machine context if relevant
  - before + after numbers and deltas
