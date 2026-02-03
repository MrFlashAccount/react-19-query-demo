import { useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/AriaComponents";

const TABS = [
  { path: "/", label: "Metrics" },
  { path: "/alerts", label: "Alerts" },
] as const;

export function MetricsAlertsTabs() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex items-center gap-1" aria-label="Metrics and Alerts navigation">
      {TABS.map((tab) => {
        const isActive = currentPath === tab.path;
        return (
          <Button
            key={tab.path}
            variant={isActive ? "solid" : "ghost"}
            size="medium"
            href={tab.path}
            className={`px-4 py-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              isActive ? "bg-primary text-invert font-medium" : "text-foreground hover:bg-hover-bg"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Button>
        );
      })}
    </nav>
  );
}
