import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Button, Text } from "@/components/AriaComponents";
import SvgMask from "@/components/SvgMask";

// Icon imports
import ComputerIcon from "@/assets/computer.svg";
import BellIcon from "@/assets/bell.svg";
import WarningIcon from "@/assets/warning.svg";
import LogsIcon from "@/assets/logs.svg";
import { Icon } from "../components/Icon";

function Header() {
  return (
    <header className="[grid-area:header] flex gap-4 items-center border-b border-border bg-background/80 px-4 py-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Icon size="large" className="rounded-4xl overflow-hidden">
          <svg
            className="h-6 w-6 text-invert bg-linear-to-br from-(--color-accent) to-(--color-info)"
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
        </Icon>
        <Text.Heading variant="h1">Monitor</Text.Heading>
      </div>
    </header>
  );
}

const NAV_ITEMS = [
  { to: "/" as const, label: "Servers", icon: ComputerIcon },
  { to: "/alerts" as const, label: "Alerts", icon: BellIcon },
  { to: "/incidents" as const, label: "Incidents", icon: WarningIcon },
  { to: "/logs" as const, label: "Logs", icon: LogsIcon },
];

function Sidebar() {
  return (
    <aside className="[grid-area:sidebar] flex flex-col border-r border-border bg-background/60 p-4">
      <Text variant="overline" color="muted" className="mb-3 uppercase tracking-wider">
        Navigation
      </Text>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Button
            icon={<SvgMask src={item.icon} className="h-5 w-5" />}
            variant="ghost"
            href={item.to}
            key={item.to}
          >
            {item.label}
          </Button>
        ))}
      </nav>
    </aside>
  );
}

const LAYOUT_SLOTS = [
  { name: "header", rowSize: "56px", slotClassNames: "flex items-center justify-start" },
  { name: "body", rowSize: "1fr", slotClassNames: "overflow-auto min-h-full" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Root Layout
// ─────────────────────────────────────────────────────────────────────────────

function Root() {
  return (
    <div className="grid h-screen w-screen gap-x-4 grid-cols-[200px_1fr] grid-rows-[auto_1fr] [grid-template-areas:'header_main-header''sidebar_main'] bg-background">
      <Header />
      <Sidebar />
      <main
        style={{
          gridTemplateAreas: LAYOUT_SLOTS.map((slot) => `"${slot.name}"`).join(" "),
          gridTemplateRows: LAYOUT_SLOTS.map((slot) => `"${slot.rowSize}"`).join(" "),
        }}
        className="row-start-1 -row-end-1 col-2 overflow-auto grid min-h-full [grid-template-areas:'header''body'] grid-rows-[56px_1fr] grid-cols-[1fr]"
      >
        <Outlet />
      </main>
    </div>
  );
}

export default createRootRoute({
  component: Root,
});

export const RootLayout = {
  Slot: ({
    children,
    name,
  }: {
    children: React.ReactNode;
    name: (typeof LAYOUT_SLOTS)[number]["name"];
  }) => {
    const slot = LAYOUT_SLOTS.find((slot) => slot.name === name);

    if (!slot) {
      throw new Error(`Slot ${name} not found`);
    }

    return (
      <div className={slot.slotClassNames} style={{ gridArea: name, gridRow: slot.rowSize }}>
        {children}
      </div>
    );
  },
};
