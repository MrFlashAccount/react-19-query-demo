# @lib/tracing ⚡

Blazing-fast tracing primitives for browser-first apps.
Zero-overhead by default, optional reporters when you need deep visibility.

## Why teams pick it

- ⚡ Blazing fast by default: production singleton is `NullTracer` (no-op path).
- 🪶 Zero-overhead mode: no reporter attached => no event processing work.
- 📦 Tight bundle size strategy: ESM + `sideEffects: false` + tree-shake friendly exports.
- 🔍 Highly performant devtools: batched reporters, Chrome Performance integration, in-app flame graph.
- 🛰️ Sentry-ready integrations: measure functions with spans, ship duration/error signals as custom perf metrics via adapter.

Use this when you need to answer things like:

- "Where does this request actually spend time?"
- "Which nested operation failed?"
- "What is the parent operation for this async task?"
- "Can I see this as a timeline, not just logs?"

## What you get 🧰

- `Tracer` + `Span` model (root and nested spans)
- `tracePromise`, `traced`, `runInSpan` helpers
- Reporter system (`LoggerReporter`, `DevtoolsReporter`, `FlameGraphReporter`)
- `NullTracer` for zero-op mode
- Node helper entrypoint with AsyncLocalStorage context propagation

## Installation

```bash
pnpm add @lib/tracing
# or
npm i @lib/tracing
# or
yarn add @lib/tracing
```

Node requirement: `>=20`.

## Performance + overhead model ⚡

This package designed around "pay only when enabled":

- ✅ Production default: singleton `tracer` is `NullTracer` (no-op behavior).
- `NullTracer` reuses one no-op span, so no per-call span allocations.
- ✅ Reporters are opt-in. No reporter, no event processing cost.
- Package is ESM + `sideEffects: false`, so unused exports can tree-shake.

Two practical modes:

1. Near-zero runtime cost (default): keep instrumentation calls, rely on default `NullTracer` in non-DEV.
2. True zero bundle/runtime for tracing path: gate tracing setup behind compile-time/dev checks and load reporter code only in DEV via dynamic import.

### True zero overhead pattern (DEV-only import) 🧪

```ts
if (import.meta.env.DEV) {
  const { setupTracer, Tracer, tracer, LoggerReporter } = await import("@lib/tracing");

  setupTracer(new Tracer());

  const logger = new LoggerReporter({ showPayloadDetails: true });
  logger.start();
  tracer.addReporter(logger);
}
```

## 60-second getting started 🚀

```ts
import { tracer, Tracer, setupTracer, LoggerReporter } from "@lib/tracing";

// Explicitly enable tracing (useful if you want it beyond DEV).
setupTracer(new Tracer());

const logger = new LoggerReporter({
  showPayloadDetails: true,
  showEndMetadata: true,
});
logger.start();
const unregister = tracer.addReporter(logger);

async function fetchUser(userId: string) {
  const span = tracer.startSpan("user.fetch", { userId }, { color: "primary" });

  try {
    const response = await fetch(`/api/users/${userId}`);
    span.event("http.response", { status: response.status });

    const user = await response.json();
    span.success({ ok: true });
    return user;
  } catch (error) {
    span.error(error);
    throw error;
  }
}

// later (teardown)
// logger.stop();
// unregister();
```

## Core mental model

- `Tracer` creates spans.
- `Span` is a unit of work with lifecycle: `start -> event* -> success|error`.
- Reporters listen to emitted trace events.
- Parent/child spans give you nested timing.

### Span lifecycle methods

- `start()`: marks span start
- `event(name, payload?)`: checkpoint in the middle
- `success(payload?)`: close as success
- `error(error, payload?)`: close as failure
- `child(...)`: create nested span under current span

## Use-case 1: Trace an existing promise

If you already have a promise, attach span lifecycle with `tracePromise`.

```ts
import { tracer, tracePromise } from "@lib/tracing";

const span = tracer.startSpan("products.load", { page: 1 }, { color: "secondary" });

const products = await tracePromise(fetch("/api/products").then((r) => r.json()), span);
```

`tracePromise` will mark `success`/`error` for you.

## Use-case 2: Wrap business function with `traced`

Root entrypoint (`@lib/tracing`) uses explicit parent passing. The wrapped function receives `span` as first arg.

```ts
import { traced, runInSpan, type ISpan } from "@lib/tracing";

const chargeCard = traced(
  async (span: ISpan, orderId: string) => {
    span.event("payment.requested", { orderId });
    // ...work
    return { ok: true };
  },
  { name: "payment.charge", meta: { color: "tertiary" } },
);

await runInSpan(async (parent) => {
  await chargeCard("order-123");

  const finalize = parent.child({ name: "order.finalize", payload: { id: "order-123" } });
  try {
    // ...work
    finalize.success();
  } catch (error) {
    finalize.error(error);
  }
}, { name: "checkout.request", payload: { route: "/checkout" } });
```

## Use-case 3: Node async context propagation

In Node, use `@lib/tracing/node` to auto-link nested async calls with `AsyncLocalStorage`.

```ts
import { setupTracer, Tracer } from "@lib/tracing";
import { runInSpan, traced, getCurrentSpan } from "@lib/tracing/node";

setupTracer(new Tracer());

const loadUser = traced(async (id: string) => {
  const parent = getCurrentSpan();
  parent?.event("db.lookup", { id });
  return { id, name: "Ada" };
}, { name: "user.load" });

await runInSpan(async () => {
  await loadUser("42");
}, { name: "http.request", payload: { method: "GET", path: "/users/42" } });
```

Notes:

- `@lib/tracing/node` `traced()` does **not** inject span arg.
- Root `@lib/tracing` `traced()` **does** inject span as first arg.

## Reporters 📣

Reporters are not auto-attached. Register them with `tracer.addReporter(reporter)`.

Runtime note:

- `LoggerReporter` and `DevtoolsReporter` process batched events internally.
- `FlameGraphReporter` is UI-heavy and browser-only; usually DEV-only.

### LoggerReporter (console output) 🪵

```ts
import { tracer, LoggerReporter } from "@lib/tracing";

const reporter = new LoggerReporter({
  showPayloadDetails: true,
  useGrouping: true,
  maxDepth: 8,
  showEndMetadata: true,
});

reporter.start();
const unregister = tracer.addReporter(reporter);
```

### DevtoolsReporter (Chrome Performance panel) 🔍

```ts
import { tracer, DevtoolsReporter } from "@lib/tracing";

const reporter = new DevtoolsReporter({
  prefix: "my-app",
  trackGroupName: "My App",
  trackName: "Tracing",
});

reporter.start();
const unregister = tracer.addReporter(reporter);

// optional cleanup of old marks/measures
// reporter.clearAll();
```

How to use:

1. Open Chrome DevTools -> Performance.
2. Start recording.
3. Trigger app flow.
4. Stop recording, inspect your spans as timing entries.

### FlameGraphReporter (in-app UI panel) 🔥

Browser-only reporter, rendered with custom elements.

```ts
import { tracer, FlameGraphReporter } from "@lib/tracing";

const flame = new FlameGraphReporter({
  buttonPosition: "bottom-right",
  // container: "#debug-root",
});

flame.mount(document.body);
const unregister = tracer.addReporter(flame);

// start collecting immediately (or use UI record button)
flame.startRecording();

// later
// flame.stopRecording();
// flame.unmount();
// unregister();
```

Recommended for production builds:

- Do not mount flame graph in prod bundle.
- Dynamic import it only in debug builds/routes.

## Production behavior (important) 🏭

Default exported singleton `tracer` is:

- `Tracer` when `import.meta.env.DEV` is truthy
- `NullTracer` otherwise

So if you need tracing outside DEV mode, call:

```ts
import { setupTracer, Tracer } from "@lib/tracing";

setupTracer(new Tracer());
```

If you intentionally want tracing disabled, keep default or set:

```ts
import { setupTracer, NullTracer } from "@lib/tracing";

setupTracer(new NullTracer());
```

## API quick reference

Main (`@lib/tracing`):

- `tracer` (singleton tracer instance)
- `setupTracer(newTracer)`
- `Tracer`
- `NullTracer`
- `tracePromise(promise, spanOrSpanOptions)`
- `traced(fnWithSpanFirstArg, options)`
- `runInSpan(fn, options)`
- reporters + reporter option types

Node (`@lib/tracing/node`):

- `traced(fn, options)`
- `runInSpan(fn, options)`
- `runWithSpan(span, fn)`
- `getCurrentSpan()`
- `Traced` decorator

Experimental browser async context (`@lib/tracing/async-context`):

- Same shape as node helper, requires `AsyncContext.Variable` support.

## Common mistakes 🛠️

### "I added a reporter, still nothing"

You likely missed one of these:

- Reporter not registered: call `tracer.addReporter(reporter)`.
- Global tracer still no-op in prod: call `setupTracer(new Tracer())`.

### "Flame graph panel shows but no spans"

- Recording is off. Click record in panel or call `flame.startRecording()`.

### "No parent-child links in async code"

- In Node, use `@lib/tracing/node` helpers for AsyncLocalStorage propagation.
- In browser/root helper mode, pass parent span explicitly when needed.

## Building a custom reporter 🧩

Extend `BaseReporter`, implement `processEvents`, then register.

```ts
import { BaseReporter, tracer, type TraceEvent } from "@lib/tracing";

class MetricsReporter extends BaseReporter {
  protected processEvents(events: TraceEvent[]): void {
    for (const event of events) {
      if (event.kind === "end") {
        // send event.span.name + duration to your metrics backend
      }
    }
  }
}

const reporter = new MetricsReporter();
reporter.start();
const unregister = tracer.addReporter(reporter);
```

## Sentry or any backend (adapter pattern) 🛰️

No built-in Sentry reporter in this package. Use adapter pattern, wire any backend.

```ts
import { BaseReporter, tracer, type TraceEvent } from "@lib/tracing";
import * as Sentry from "@sentry/browser";

interface TraceAdapter {
  onEvents(events: TraceEvent[]): void;
}

class AdapterReporter extends BaseReporter {
  constructor(private adapter: TraceAdapter) {
    super({ useBatching: true });
  }

  protected processEvents(events: TraceEvent[]): void {
    this.adapter.onEvents(events);
  }
}

class SentryTraceAdapter implements TraceAdapter {
  onEvents(events: TraceEvent[]): void {
    for (const event of events) {
      if (event.kind === "event") {
        Sentry.addBreadcrumb({
          category: "trace.event",
          message: event.eventName,
          level: "info",
          data: event.payload,
        });
      }

      if (event.kind === "end" && event.status === "error") {
        Sentry.captureException(event.error, {
          tags: { span: event.span.name },
          extra: event.payload,
        });
      }
    }
  }
}

const reporter = new AdapterReporter(new SentryTraceAdapter());
reporter.start();
tracer.addReporter(reporter);
```

If you need Datadog/Honeycomb/OpenTelemetry/custom endpoint, keep same `TraceAdapter` interface and swap adapter only.

## License

MIT
