import { Link } from "@tanstack/react-router";
import { Text } from "../AriaComponents";

export function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent-cyan)] to-[var(--color-accent-emerald)]">
            <svg
              className="h-5 w-5 text-invert"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <path
                d="M3 18 L7 10 L11 14 L17 4 L21 12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <Text variant="subtitle" weight="semibold" className="text-primary">
            Infrastructure Monitor
          </Text>
        </div>
      </div>

      <nav className="hidden items-center gap-2 sm:flex">
        <Link
          to="/"
          className="rounded-md px-3 py-1.5 text-sm text-primary/70 hover:bg-hover-bg hover:text-primary transition-colors"
          activeProps={{
            className: "rounded-md bg-hover-bg px-3 py-1.5 text-sm text-primary",
          }}
        >
          Dashboard
        </Link>
        <Link
          to="/alerts"
          className="rounded-md px-3 py-1.5 text-sm text-primary/70 hover:bg-hover-bg hover:text-primary transition-colors"
          activeProps={{
            className: "rounded-md bg-hover-bg px-3 py-1.5 text-sm text-primary",
          }}
        >
          Alerts
        </Link>
      </nav>
    </header>
  );
}
