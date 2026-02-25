# TASK-18: README And Architecture Note

## Size

S

## Goal

Document runbook for humans and LLM follow-up implementers.

## Depends On

- TASK-17

## Files To Create

- `examples/incident-war-room/README.md`

## Detailed Steps

1. Add sections:
   - what app demonstrates
   - architecture split (mutation lane vs compute lane)
   - folder map
   - dev/build/test commands
   - demo script steps
2. Include known constraints from AGENTS (browser-runtime test model).
3. Add troubleshooting for missing worker transport/bootstrap errors.

## Definition Of Done (DoD)

- README contains exact runnable commands.
- Dual-core architecture explained with module references.
- New contributor can run and verify app from README only.
