import { Suspense } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Header } from "@components/shared/Header";
import { Sidebar } from "@components/shared/Sidebar";

export const Route = createRootRoute({
  component: RootLayout,
});

function HeaderFallback() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500">
            <svg className="h-5 w-5 text-slate-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 18 L7 10 L11 14 L17 4 L21 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-lg font-semibold text-slate-100">Infrastructure Monitor</span>
        </div>
        <div className="ml-6 flex items-center gap-4">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-800" />
        </div>
      </div>
    </header>
  );
}

function RootLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950">
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
