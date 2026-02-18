# Worker Wire Format Comparison Report (2026-02-18)

## Scope

- Package: `@lib/rsc-prism`
- Goal: re-validate implementation and compare current perf numbers against existing stress-profile reference in `/Users/sergeygarin/Projects/react-19-query-demo/lib/rsc-prism/test/perf/results/latest.md`

## Commands Run

### Functional re-validation

```bash
pnpm --filter @lib/rsc-prism exec vitest run
```

Result: `109 passed`, `3 skipped`.

### Typical profile (3 runs)

```bash
RSC_PERF=1 \
RSC_PERF_ITERATIONS=12 \
RSC_PERF_ROW_COUNT=2000 \
RSC_PERF_CHUNK_SIZES=128,256,1024 \
RSC_PERF_BINARY_ROW_COUNT=600 \
RSC_PERF_BINARY_ROW_BYTES=256 \
RSC_PERF_SERVER_ITEM_COUNT=500 \
RSC_PERF_SERVER_ITEM_BYTES=256 \
pnpm --filter @lib/rsc-prism exec vitest run --project unit \
  test/perf/flight-runtime.client-stream-perf.unit.test.ts \
  test/perf/flight-runtime.decode-perf.unit.test.ts \
  test/perf/flight-runtime.server-decode-reply-perf.unit.test.ts
```

### Stress profile (3 runs)

```bash
RSC_PERF=1 \
RSC_PERF_ITERATIONS=8 \
RSC_PERF_ROW_COUNT=12000 \
RSC_PERF_CHUNK_SIZES=64,256,1024 \
RSC_PERF_BINARY_ROW_COUNT=4000 \
RSC_PERF_BINARY_ROW_BYTES=384 \
RSC_PERF_SERVER_ITEM_COUNT=1800 \
RSC_PERF_SERVER_ITEM_BYTES=384 \
pnpm --filter @lib/rsc-prism exec vitest run --project unit \
  test/perf/flight-runtime.client-stream-perf.unit.test.ts \
  test/perf/flight-runtime.decode-perf.unit.test.ts \
  test/perf/flight-runtime.server-decode-reply-perf.unit.test.ts
```

## Exact Numbers

### Typical profile (run-by-run)

| Metric | Run 1 | Run 2 | Run 3 | Median |
| --- | ---: | ---: | ---: | ---: |
| synthetic-wire-decode | 2.31 ms | 1.99 ms | 1.96 ms | 1.99 ms |
| synthetic-binary-wire-decode (rows=600, bytes=256) | 0.37 ms | 0.38 ms | 0.38 ms | 0.38 ms |
| stream-parse+decode (chunk=128) | 4.76 ms | 4.35 ms | 4.31 ms | 4.35 ms |
| stream-parse+decode (chunk=256) | 2.39 ms | 2.06 ms | 1.96 ms | 2.06 ms |
| stream-parse+decode (chunk=1024) | 1.79 ms | 1.75 ms | 1.71 ms | 1.75 ms |
| server-decodeReply (items=500, itemBytes=256) | 6.91 ms | 6.67 ms | 6.50 ms | 6.67 ms |

### Stress profile (run-by-run)

| Metric | Run 1 | Run 2 | Run 3 | Median |
| --- | ---: | ---: | ---: | ---: |
| synthetic-wire-decode | 4.14 ms | 2.78 ms | 2.59 ms | 2.78 ms |
| synthetic-binary-wire-decode (rows=4000, bytes=384) | 2.41 ms | 2.34 ms | 1.79 ms | 2.34 ms |
| stream-parse+decode (chunk=64) | 24.92 ms | 24.84 ms | 20.00 ms | 24.84 ms |
| stream-parse+decode (chunk=256) | 13.63 ms | 14.45 ms | 13.53 ms | 13.63 ms |
| stream-parse+decode (chunk=1024) | 11.91 ms | 11.73 ms | 11.89 ms | 11.89 ms |
| server-decodeReply (items=1800, itemBytes=384) | 30.35 ms | 30.05 ms | 26.90 ms | 30.05 ms |

## Comparison Against Existing Stress Report

Reference file: `/Users/sergeygarin/Projects/react-19-query-demo/lib/rsc-prism/test/perf/results/latest.md`

| Metric | Existing Baseline | Existing After Opt | Current Median | Delta vs Baseline | Delta vs Existing After |
| --- | ---: | ---: | ---: | ---: | ---: |
| synthetic-wire-decode | 1.97 ms | 2.04 ms | 2.78 ms | +0.81 ms (+41.1%) | +0.74 ms (+36.3%) |
| synthetic-binary-wire-decode (rows=4000, bytes=384) | 1.90 ms | 1.61 ms | 2.34 ms | +0.44 ms (+23.2%) | +0.73 ms (+45.3%) |
| stream-parse+decode (chunk=64) | 20.09 ms | 19.65 ms | 24.84 ms | +4.75 ms (+23.6%) | +5.19 ms (+26.4%) |
| stream-parse+decode (chunk=256) | 15.10 ms | 14.56 ms | 13.63 ms | -1.47 ms (-9.7%) | -0.93 ms (-6.4%) |
| stream-parse+decode (chunk=1024) | 12.58 ms | 12.63 ms | 11.89 ms | -0.69 ms (-5.5%) | -0.74 ms (-5.9%) |
| server-decodeReply (items=1800, itemBytes=384) | 24.29 ms | 23.31 ms | 30.05 ms | +5.76 ms (+23.7%) | +6.74 ms (+28.9%) |

## Summary

- Current stress-profile median is better for:
  - `stream-parse+decode` at chunk sizes `256` and `1024`.
- Current stress-profile median is worse for:
  - `synthetic-wire-decode`
  - `synthetic-binary-wire-decode`
  - `stream-parse+decode` at chunk size `64`
  - `server-decodeReply`
- Perf tests pass functionally in all runs; results indicate significant machine/session variability and no across-the-board gain versus the existing stress report.
