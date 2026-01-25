import { Button, Text } from "./AriaComponents";

export function Dashboard() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <Text.Heading level={1} variant="h1" className="mb-1">
            Dashboard
          </Text.Heading>
          <Text variant="body" color="muted">
            Monitoring dashboard scaffold (routes + layout restored).
          </Text>
        </div>
        <Button variant="accent" href="/alerts" rounded="medium">
          View alerts
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-dashboard/40 p-4">
          <Text variant="overline" color="muted" className="uppercase tracking-wide">
            Servers
          </Text>
          <Text variant="h1" className="mt-2">
            —
          </Text>
          <Text variant="caption" color="muted" className="mt-1">
            Connect data/widgets later
          </Text>
        </div>
        <div className="rounded-xl border border-border bg-dashboard/40 p-4">
          <Text variant="overline" color="muted" className="uppercase tracking-wide">
            Errors
          </Text>
          <Text variant="h1" className="mt-2">
            —
          </Text>
          <Text variant="caption" color="muted" className="mt-1">
            Hook up alerts pipeline
          </Text>
        </div>
        <div className="rounded-xl border border-border bg-dashboard/40 p-4">
          <Text variant="overline" color="muted" className="uppercase tracking-wide">
            Latency
          </Text>
          <Text variant="h1" className="mt-2">
            —
          </Text>
          <Text variant="caption" color="muted" className="mt-1">
            Charts can go here
          </Text>
        </div>
      </div>
    </div>
  );
}
