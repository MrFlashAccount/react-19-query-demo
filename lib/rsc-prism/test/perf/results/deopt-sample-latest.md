# rsc-prism deopt sample report

- Generated at: 2026-02-18T13:44:10.427Z
- Input log: `/tmp/rsc-prism-deopt-sample.latest.log`
- Source filter root: `/Users/sergeygarin/Projects/react-19-query-demo/lib/rsc-prism/src`

## Totals

- Deopt events (all): 10
- Deopt events (matched package functions): 0

## Top Deopt Reasons (All)

- `Insufficient type feedback for generic named access`: 2
- `not a Smi`: 2
- `wrong map`: 2
- `Insufficient type feedback for binary operation`: 1
- `Insufficient type feedback for unary operation`: 1
- `Insufficient type feedback for compare operation`: 1
- `wrong call target`: 1

## Top Deopt Reasons (Matched Package Functions)

- _(none)_

## Top Deoptimized Package Functions

- _(none)_

## Notes

- Package-function matching prefers deopt source paths under `src/`, with a function-name fallback.
- This report is intended for trend tracking, not as a hard CI gate.
