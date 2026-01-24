import { Link } from "@tanstack/react-router";

export function Dashboard() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6 text-slate-100">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Monitoring dashboard scaffold (routes + layout restored).
          </p>
        </div>
        <Link
          to="/alerts"
          className="rounded-md bg-cyan-600 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-500"
        >
          View alerts
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Servers</div>
          <div className="mt-2 text-3xl font-semibold">—</div>
          <div className="mt-1 text-xs text-slate-500">Connect data/widgets later</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Errors</div>
          <div className="mt-2 text-3xl font-semibold">—</div>
          <div className="mt-1 text-xs text-slate-500">Hook up alerts pipeline</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Latency</div>
          <div className="mt-2 text-3xl font-semibold">—</div>
          <div className="mt-1 text-xs text-slate-500">Charts can go here</div>
        </div>
      </div>
    </div>
  );
}
