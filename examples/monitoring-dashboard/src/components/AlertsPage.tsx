import { Link } from "@tanstack/react-router";

export function AlertsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6 text-slate-100">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Alerts</h1>
          <p className="mt-1 text-sm text-slate-400">Minimal page placeholder.</p>
        </div>
        <Link
          to="/"
          className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
        No alert UI wired yet.
      </div>
    </div>
  );
}
