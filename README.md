# React 19 Query Demo Monorepo

Monorepo with shared libs in `lib/*` and apps in `examples/*`.

## Apps

- `examples/landing`
- `examples/movies-db`
- `examples/monitoring-dashboard`

## Vercel (single project)

Use one Vercel project with repo root as Root Directory.

- Root Directory: `.`
- Build command: `pnpm run build:vercel:single`
- Output directory: `dist`
- Config file: `vercel.json` at repo root

This produces:

- `/` -> landing
- `/movies-db/*` -> movies app
- `/monitoring-dashboard/*` -> monitoring dashboard app

Service workers are scoped per app path so they do not conflict.

## Local verify for single-project deploy

```bash
pnpm run build:vercel:single
pnpm dlx serve dist
```
