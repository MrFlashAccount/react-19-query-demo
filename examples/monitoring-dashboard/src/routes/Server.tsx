import { createRoute } from "@tanstack/react-router";
import Root, { RootLayout } from "./__root";
import { Dropdown, Text } from "@/components/AriaComponents";
import { useQuery } from "@lib/goat-query/react";
import { use, useState, createContext, useContext, Suspense } from "react";
import { serversQuery, metricsQuery, logsQuery } from "../queries";
import type { Server as ServerType, Metric, LogLevel } from "@/db/schema";
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
// Context for selected server
// ─────────────────────────────────────────────────────────────────────────────

interface ServerContextValue {
  server: ServerType | null;
  servers: ServerType[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
}

const ServerContext = createContext<ServerContextValue | null>(null);

function useServerContext() {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error("useServerContext must be used within ServerProvider");
  return ctx;
}

function ServerProvider({ children }: { children: React.ReactNode }) {
  const { promise } = useQuery({ query: serversQuery, params: undefined });
  const servers = use(promise);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const server = servers[selectedIndex] ?? null;

  return (
    <ServerContext.Provider value={{ server, servers, selectedIndex, setSelectedIndex }}>
      {children}
    </ServerContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Server Component
// ─────────────────────────────────────────────────────────────────────────────

function Server() {
  return (
    <Suspense fallback={<ServerLoadingState />}>
      <ServerProvider>
        <RootLayout.Slot slotName="header">
          <div className="flex items-center gap-2 px-4">
            <Text.Heading variant="h1">Server</Text.Heading>
            <ServerDropdown />
          </div>
        </RootLayout.Slot>

        <RootLayout.Slot slotName="body">
          <ServerBody />
        </RootLayout.Slot>
      </ServerProvider>
    </Suspense>
  );
}

function ServerLoadingState() {
  return (
    <RootLayout.Slot slotName="body">
      <div className="flex h-full items-center justify-center">
        <Text color="muted">Loading servers...</Text>
      </div>
    </RootLayout.Slot>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Body
// ─────────────────────────────────────────────────────────────────────────────
const endTime = Date.now();
const startTime = endTime - 6 * 60 * 60 * 1000; // Last 6 hours

function ServerBody() {
  const { server } = useServerContext();

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
      <ServerLogsTable serverId={server.id} startTime={startTime} endTime={endTime} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Overview Cards
// ─────────────────────────────────────────────────────────────────────────────

function ServerOverview({ server }: { server: ServerType }) {
  const statusColors: Record<ServerType["status"], string> = {
    healthy: "bg-success/20 text-success border-success/30",
    warning: "bg-warning/20 text-warning border-warning/30",
    critical: "bg-danger/20 text-danger border-danger/30",
    offline: "bg-primary/10 text-primary/50 border-primary/20",
  };

  const lastSeenFormatted = new Date(server.lastSeen).toLocaleString();
  const uptimeMs = Date.now() - server.createdAt;
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
      <Text variant="body" weight="semibold" className="capitalize">
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
    new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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

function ChartSkeleton() {
  return (
    <section>
      <div className="mb-3 h-5 w-32 animate-pulse rounded bg-primary/10" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-lg border border-border bg-primary/5"
          />
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Logs Table
// ─────────────────────────────────────────────────────────────────────────────

function ServerLogsTable({
  serverId,
  startTime,
  endTime,
}: {
  serverId: string;
  startTime: number;
  endTime: number;
}) {
  const { promise } = useQuery({
    query: logsQuery,
    params: { serverId, startTime, endTime, limit: 50 },
  });
  const { logs, total } = use(promise);

  const levelColors: Record<LogLevel, string> = {
    debug: "text-primary/50",
    info: "text-info",
    warn: "text-warning",
    error: "text-danger",
    critical: "text-danger font-bold",
  };

  const errorCount = logs.filter((l) => l.level === "error" || l.level === "critical").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <Text.Heading level={2} variant="subtitle">
          Recent Logs
        </Text.Heading>
        <div className="flex gap-3">
          <Text variant="body-sm" color="muted">
            Total: {total}
          </Text>
          {errorCount > 0 && (
            <Text variant="body-sm" className="text-danger">
              Errors: {errorCount}
            </Text>
          )}
          {warnCount > 0 && (
            <Text variant="body-sm" className="text-warning">
              Warnings: {warnCount}
            </Text>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-150">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-3 py-2 text-left">
                  <Text variant="overline" color="muted">
                    Time
                  </Text>
                </th>
                <th className="px-3 py-2 text-left">
                  <Text variant="overline" color="muted">
                    Level
                  </Text>
                </th>
                <th className="px-3 py-2 text-left">
                  <Text variant="overline" color="muted">
                    Service
                  </Text>
                </th>
                <th className="px-3 py-2 text-left">
                  <Text variant="overline" color="muted">
                    Message
                  </Text>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-hover-bg transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Text variant="body-sm" monospace>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                  </td>
                  <td className="px-3 py-2">
                    <Text
                      variant="body-sm"
                      weight="semibold"
                      className={`uppercase ${levelColors[log.level]}`}
                    >
                      {log.level}
                    </Text>
                  </td>
                  <td className="px-3 py-2">
                    <Text variant="body-sm" color="muted">
                      {log.service ?? "—"}
                    </Text>
                  </td>
                  <td className="px-3 py-2">
                    <Text variant="body-sm" truncate>
                      {log.message}
                    </Text>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center">
                    <Text color="muted">No logs found</Text>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function TableSkeleton() {
  return (
    <section>
      <div className="mb-3 h-5 w-24 animate-pulse rounded bg-primary/10" />
      <div className="h-64 animate-pulse rounded-lg border border-border bg-primary/5" />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Dropdown
// ─────────────────────────────────────────────────────────────────────────────

function ServerDropdown() {
  const { servers, selectedIndex, setSelectedIndex } = useServerContext();

  const serverOptions = servers.map((server) => ({ id: server.id, name: server.name }));

  return (
    <Dropdown<(typeof serverOptions)[number]>
      items={serverOptions}
      selectedIndex={selectedIndex}
      onChange={(_, index) => setSelectedIndex(index)}
      aria-label="Select server"
      size="medium"
    >
      {({ item }) => (
        <span className="flex items-center gap-2">
          <span>{item.name}</span>
        </span>
      )}
    </Dropdown>
  );
}

export default createRoute({
  getParentRoute: () => Root,
  path: "/",
  component: Server,
});
