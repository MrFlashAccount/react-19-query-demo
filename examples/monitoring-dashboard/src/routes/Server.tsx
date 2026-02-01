import { createRoute } from "@tanstack/react-router";
import Root, { RootLayout } from "./__root";
import { Button, Text } from "@/components/AriaComponents";
import { useQuery } from "@lib/goat-query/react";
import { use, useState, Suspense, useTransition, useEffect } from "react";
import { serversQuery, metricsQuery } from "../queries";
import type { Server as ServerType, Metric } from "@/db/schema";
import { ServerContext, useServerContext } from "./Server/ServerContext";
import { ServerSelector } from "./Server/ServerSelectorPopover";
import { LogsTable } from "./Server/components/LogsTable";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useEvent } from "@/hooks/useEvent";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

// ─────────────────────────────────────────────────────────────────────────────
// Re-export context types for convenience
// ─────────────────────────────────────────────────────────────────────────────

import type { ServerContextValue } from "./Server/ServerContext";
export type { ServerContextValue };

function ServerProvider({
  children,
  endTime,
  startTime,
  onTimeRangeChange,
}: {
  children: React.ReactNode;
  endTime: number;
  startTime: number;
  onTimeRangeChange?: (startTime: number, endTime: number) => void;
}) {
  const { promise } = useQuery({ query: serversQuery, params: undefined });
  const servers = use(promise);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isLoading, startTransition] = useTransition();
  const server = servers[selectedIndex] ?? null;

  const selectServer = useEvent((index: number) =>
    startTransition(() => {
      setSelectedIndex(index);
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
        endTime,
        startTime,
        onTimeRangeChange,
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
  const [endTime, setEndTime] = useState(() => Date.now());
  const [startTime, setStartTime] = useState(() => endTime - 6 * 60 * 60 * 1000);
  const [, startTransition] = useTransition();

  const handleTimeRangeChange = (newStartTime: number, newEndTime: number) => {
    startTransition(() => {
      setStartTime(newStartTime);
      setEndTime(newEndTime);
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      startTransition(() => {
        setEndTime(Date.now());
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ServerProvider endTime={endTime} startTime={startTime} onTimeRangeChange={handleTimeRangeChange}>
      <RootLayout.Slot name="header">
        <div className="flex items-center gap-2 px-4 w-full">
          <Text.Heading variant="h1">Server</Text.Heading>
          <ServerSelectorWrapper />
        </div>
      </RootLayout.Slot>

      <RootLayout.Slot name="body">
        <Suspense fallback={<ServerLoadingState />}>
          <ServerBody />
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
// Server Body
// ─────────────────────────────────────────────────────────────────────────────

function ServerBody() {
  const { server, endTime, startTime, onTimeRangeChange } = useServerContext();

  if (!server) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text color="muted">No server selected</Text>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 overflow-auto">
      <ServerOverview server={server} />
      <ServerMetricsCharts serverId={server.id} startTime={startTime} endTime={endTime} />
      <LogsTable serverId={server.id} startTime={startTime} endTime={endTime} onTimeRangeChange={onTimeRangeChange} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Overview Cards
// ─────────────────────────────────────────────────────────────────────────────

function ServerOverview({ server }: { server: ServerType }) {
  const { endTime } = useServerContext();
  const statusColors: Record<ServerType["status"], string> = {
    healthy: "bg-success/20 text-success border-success/30",
    warning: "bg-warning/20 text-warning border-warning/30",
    critical: "bg-danger/20 text-danger border-danger/30",
    offline: "bg-primary/10 text-primary/50 border-primary/20",
  };

  const lastSeenFormatted = new Date(server.lastSeen).toLocaleString();
  const uptimeMs = endTime - server.createdAt;
  const uptimeDays = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));

  return (
    <section>
      <Text.Heading level={2} variant="subtitle" className="mb-3">
        Overview
      </Text.Heading>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Status" value={server.status} className={statusColors[server.status]} />
        <StatCard label="Region" value={server.region} />
        <StatCard label="IP Address" value={server.ip} />
        <StatCard label="Uptime" value={`${uptimeDays} days`} />
        <StatCard label="Last Seen" value={lastSeenFormatted} />
        <StatCard label="Tags" value={server.tags.join(", ") || "—"} />
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-background/60 p-3 backdrop-blur-sm ${className}`}
    >
      <Text variant="overline" color="muted" className="mb-1 block">
        {label}
      </Text>
      <Text variant="body" weight="semibold">
        {value}
      </Text>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Metrics Charts
// ─────────────────────────────────────────────────────────────────────────────

function ServerMetricsCharts({
  serverId,
  startTime,
  endTime,
}: {
  serverId: string;
  startTime: number;
  endTime: number;
}) {
  const { promise } = useQuery({
    query: metricsQuery,
    params: { serverIds: [serverId], startTime, endTime },
  });
  const metrics = use(promise);

  const chartData = prepareChartData(metrics);

  return (
    <section>
      <Text.Heading level={2} variant="subtitle" className="mb-3">
        Metrics (Last 6 Hours)
      </Text.Heading>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="CPU Usage (%)" data={chartData.cpu} color="rgba(241, 162, 29, 1)" />
        <ChartCard
          title="Memory Usage (%)"
          data={chartData.memory}
          color="rgba(102, 204, 255, 1)"
        />
        <ChartCard
          title="Network In (KB/s)"
          data={chartData.networkIn}
          color="rgba(102, 255, 102, 1)"
        />
        <ChartCard
          title="Network Out (KB/s)"
          data={chartData.networkOut}
          color="rgba(255, 102, 102, 1)"
        />
      </div>
    </section>
  );
}

interface ChartDataPoint {
  labels: string[];
  values: number[];
}

function prepareChartData(metrics: Metric[]): {
  cpu: ChartDataPoint;
  memory: ChartDataPoint;
  networkIn: ChartDataPoint;
  networkOut: ChartDataPoint;
} {
  // Sort by timestamp and sample every 5th point to reduce data density
  const sorted = [...metrics].sort((a, b) => a.timestamp - b.timestamp);
  const sampled = sorted.filter((_, i) => i % 5 === 0);

  const labels = sampled.map((m) =>
    new Date(m.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  );

  return {
    cpu: { labels, values: sampled.map((m) => m.cpu) },
    memory: { labels, values: sampled.map((m) => m.memory) },
    networkIn: { labels, values: sampled.map((m) => m.networkIn / 1000) },
    networkOut: { labels, values: sampled.map((m) => m.networkOut / 1000) },
  };
}

function ChartCard({ title, data, color }: { title: string; data: ChartDataPoint; color: string }) {
  const chartConfig = {
    labels: data.labels,
    datasets: [
      {
        label: title,
        data: data.values,
        borderColor: color,
        backgroundColor: color.replace("1)", "0.1)"),
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index" as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: { maxTicksLimit: 8, font: { size: 10 } },
      },
      y: {
        display: true,
        grid: { color: "rgba(0,0,0,0.05)" },
        ticks: { font: { size: 10 } },
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false,
    },
  };

  return (
    <div className="rounded-lg border border-border bg-background/60 p-4 backdrop-blur-sm">
      <Text variant="body" weight="semibold" className="mb-2 block">
        {title}
      </Text>
      <div className="h-48">
        <Line data={chartConfig} options={options} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Selector Wrapper
// ─────────────────────────────────────────────────────────────────────────────

function ServerSelectorWrapper() {
  const { server } = useServerContext();

  return (
    <ServerSelector
      triggerButton={
        <Button variant="outline" size="medium" className="flex items-center gap-2">
          <span>{server?.name ?? "Select Server"}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </Button>
      }
    />
  );
}

export default createRoute({
  getParentRoute: () => Root,
  path: "/",
  component: Server,
});
