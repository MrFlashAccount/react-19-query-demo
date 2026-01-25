import { Link } from "@tanstack/react-router";
import { Button } from "../AriaComponents";

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-800 bg-slate-950/60 p-3 sm:block">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Navigation</div>
      <Button variant="link" href="/">
        Dashboard
      </Button>
      <nav className="mt-2 flex flex-col gap-1">
        <Link
          to="/"
          className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 hover:text-slate-100"
          activeProps={{ className: "rounded-md bg-slate-900 px-3 py-2 text-sm text-slate-100" }}
        >
          Dashboard
        </Link>
        <Link
          to="/alerts"
          className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 hover:text-slate-100"
          activeProps={{ className: "rounded-md bg-slate-900 px-3 py-2 text-sm text-slate-100" }}
        >
          Alerts
        </Link>
      </nav>
    </aside>
  );
}
