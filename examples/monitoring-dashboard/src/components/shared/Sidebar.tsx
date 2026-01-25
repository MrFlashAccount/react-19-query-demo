import { Link } from "@tanstack/react-router";
import { Text } from "../AriaComponents";

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-background/60 p-3 sm:block">
      <Text variant="overline" color="muted" className="uppercase tracking-wide">
        Navigation
      </Text>
      <nav className="mt-2 flex flex-col gap-1">
        <Link
          to="/"
          className="rounded-md px-3 py-2 text-sm text-primary/70 hover:bg-hover-bg hover:text-primary transition-colors"
          activeProps={{
            className: "rounded-md bg-hover-bg px-3 py-2 text-sm text-primary",
          }}
        >
          Dashboard
        </Link>
        <Link
          to="/alerts"
          className="rounded-md px-3 py-2 text-sm text-primary/70 hover:bg-hover-bg hover:text-primary transition-colors"
          activeProps={{
            className: "rounded-md bg-hover-bg px-3 py-2 text-sm text-primary",
          }}
        >
          Alerts
        </Link>
      </nav>
    </aside>
  );
}
