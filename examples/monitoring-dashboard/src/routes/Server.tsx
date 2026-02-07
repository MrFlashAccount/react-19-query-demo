import { createRoute } from "@tanstack/react-router";
import Root, { RootLayout } from "./__root";
import { Text } from "@/components/AriaComponents";
import { use, useState, Suspense, useTransition, useEffect } from "react";
import { serversQuery, serverRSCQuery } from "../queries";
import { ServerContext, useServerContext } from "./Server/ServerContext";
import { ServerSelectorWrapper } from "./Server/client-components";
import { TimeRangeSelector } from "./Server/TimeRangeSelector";
import { useQuery } from "@lib/goat-query/react";
import { useEvent } from "@/hooks/useEvent";
import { MetricsAlertsTabs } from "@/components/MetricsAlertsTabs";
import type { ServerContextValue } from "./Server/ServerContext";
export type { ServerContextValue };

function ServerProvider({
  children,
  range,
  onRangeChange,
  serverId,
  onServerChange,
  refreshData,
  autoRefreshInterval,
  setAutoRefreshInterval,
}: {
  children: React.ReactNode;
  range: string;
  onRangeChange?: (range: string) => void;
  serverId: string | null;
  onServerChange: (serverId: string | null) => void;
  refreshData: () => void;
  autoRefreshInterval: number | null;
  setAutoRefreshInterval: (interval: number | null) => void;
}) {
  const { promise } = useQuery({ query: serversQuery, params: undefined });
  const servers = use(promise);
  const [isLoading, startTransition] = useTransition();

  const selectedIndex = serverId ? servers.findIndex((s) => s.id === serverId) : 0;
  const server = servers[selectedIndex] ?? null;

  const selectServer = useEvent((index: number) =>
    startTransition(() => {
      const newServer = servers[index];
      onServerChange(newServer?.id ?? null);
    }),
  );

  return (
    <ServerContext.Provider
      value={{
        server,
        servers,
        selectedIndex,
        selectServer,
        isLoading,
        range,
        onRangeChange,
        refreshData,
        autoRefreshInterval,
        setAutoRefreshInterval,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Server Component
// ─────────────────────────────────────────────────────────────────────────────

function Server() {
  const [range, setRange] = useState<string>("last_6h");
  const [serverId, setServerId] = useState<string | null>(null);
  const [limit] = useState(1_000);
  const [offset, setOffset] = useState(0);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number | null>(10_000);
  const [refreshKey, setRefreshKey] = useState(0);
  const [, startTransition] = useTransition();

  const handleRangeChange = (newRange: string) => {
    startTransition(() => {
      setRange(newRange);
      setOffset(0); // Reset pagination on range change
    });
  };

  const handleServerChange = (newServerId: string | null) => {
    startTransition(() => {
      setServerId(newServerId);
      setOffset(0); // Reset pagination on server change
    });
  };

  const handleRefresh = useEvent(() => {
    startTransition(() => {
      // Increment key to force fresh data fetch with same range
      setRefreshKey((prev) => prev + 1);
    });
  });

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefreshInterval === null) return;

    const interval = setInterval(() => {
      startTransition(() => {
        setRefreshKey((prev) => prev + 1);
      });
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [autoRefreshInterval]);

  return (
    <ServerProvider
      range={range}
      onRangeChange={handleRangeChange}
      serverId={serverId}
      onServerChange={handleServerChange}
      refreshData={handleRefresh}
      autoRefreshInterval={autoRefreshInterval}
      setAutoRefreshInterval={setAutoRefreshInterval}
    >
      <RootLayout.Slot name="header">
        <div className="flex items-center justify-between gap-4 px-4 w-full">
          <div className="flex items-center gap-4">
            <MetricsAlertsTabs />
            <ServerSelectorWrapperWithContext />
          </div>
          <TimeRangeSelectorWithContext />
        </div>
      </RootLayout.Slot>

      <RootLayout.Slot name="body">
        <Suspense fallback={<ServerLoadingState />}>
          <ServerBody serverId={serverId} range={range} limit={limit} offset={offset} />
        </Suspense>
      </RootLayout.Slot>
    </ServerProvider>
  );
}

function ServerLoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <Text color="muted">Loading servers...</Text>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Body (RSC Fetcher)
// ─────────────────────────────────────────────────────────────────────────────

function ServerBody({
  serverId,
  range,
  limit,
  offset,
}: {
  serverId: string | null;
  range: string;
  limit: number;
  offset: number;
}) {
  const { promise } = useQuery({
    query: serverRSCQuery,
    params: { serverId, range, limit, offset },
  });

  const element = use(promise);

  return <>{element}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Selector Wrapper (with Context)
// ─────────────────────────────────────────────────────────────────────────────

function ServerSelectorWrapperWithContext() {
  const { server } = useServerContext();
  return <ServerSelectorWrapper server={server} />;
}

function TimeRangeSelectorWithContext() {
  return <TimeRangeSelector />;
}

export default createRoute({
  getParentRoute: () => Root,
  path: "/",
  component: Server,
});
