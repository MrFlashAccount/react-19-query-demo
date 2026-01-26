import { Link, useRouter } from "@tanstack/react-router";
import { Button, Text, Dialog } from "../AriaComponents";
import { Icon } from "../Icon";
import { useState } from "react";

const NAV_LINKS = [
  { to: "/", label: "Dashboard", icon: "root" },
  { to: "/servers", label: "Servers", icon: "computer" },
  { to: "/alerts", label: "Alerts", icon: "bell" },
  { to: "/incidents", label: "Incidents", icon: "warning" },
  { to: "/logs", label: "Logs", icon: "logs" },
] as const;

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-info)]">
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
          <Text variant="subtitle" weight="semibold" className="text-primary hidden sm:block">
            Infrastructure Monitor
          </Text>
        </div>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden items-center gap-2 sm:flex">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-md px-3 py-1.5 text-sm text-primary/70 hover:bg-hover-bg hover:text-primary transition-colors"
            activeProps={{
              className: "rounded-md bg-hover-bg px-3 py-1.5 text-sm text-primary",
            }}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Mobile Menu Button */}
      <div className="sm:hidden">
        <Button
          variant="ghost"
          size="small"
          aria-label="Open navigation menu"
          onPress={() => setMobileMenuOpen(true)}
        >
          <Icon icon="burger_menu" />
        </Button>

        {mobileMenuOpen && (
          <Dialog
            title="Navigation"
            type="fullscreen"
            onOpenChange={(isOpen) => !isOpen && setMobileMenuOpen(false)}
            isDismissable
          >
            {({ close }) => (
              <nav className="flex flex-col gap-2 p-4">
                {NAV_LINKS.map((link) => {
                  const isActive = router.state.location.pathname === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => {
                        handleNavClick();
                        close();
                      }}
                      className={`flex items-center gap-3 rounded-lg px-4 py-3 text-base transition-colors ${
                        isActive
                          ? "bg-accent/10 text-accent"
                          : "text-primary/70 hover:bg-hover-bg hover:text-primary"
                      }`}
                    >
                      <Icon icon={link.icon} className="h-5 w-5" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </Dialog>
        )}
      </div>
    </header>
  );
}
