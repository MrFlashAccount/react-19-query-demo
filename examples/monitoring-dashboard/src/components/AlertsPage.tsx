import { Link } from "@tanstack/react-router";
import { Button, Text } from "./AriaComponents";

export function AlertsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <Text.Heading level={1} variant="h1" className="mb-1">
            Alerts
          </Text.Heading>
          <Text variant="body" color="muted">
            Minimal page placeholder.
          </Text>
        </div>
        <Button variant="outline" href="/" rounded="medium">
          Back to dashboard
        </Button>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-dashboard/40 p-4">
        <Text variant="body" color="muted">
          No alert UI wired yet.
        </Text>
      </div>
    </div>
  );
}
