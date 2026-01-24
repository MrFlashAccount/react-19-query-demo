import { Link } from "@tanstack/react-router";

export function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-cyan-500 to-emerald-500">
            <svg
              className="h-5 w-5 text-slate-900"
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
          <span className="text-lg font-semibold text-slate-100">Infrastructure Monitor</span>
        </div>
      </div>

      <nav className="hidden items-center gap-2 sm:flex">
        <Link
          to="/"
          className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          activeProps={{ className: "rounded-md bg-slate-800 px-3 py-1.5 text-sm text-slate-100" }}
        >
          Dashboard
        </Link>
        <Link
          to="/alerts"
          className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          activeProps={{ className: "rounded-md bg-slate-800 px-3 py-1.5 text-sm text-slate-100" }}
        >
          Alerts
        </Link>
      </nav>
    </header>
  );
}
