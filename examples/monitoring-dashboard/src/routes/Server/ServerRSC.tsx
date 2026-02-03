/**
 * Server Components for Server Page
 *
 * This module runs in the Service Worker and renders RSC.
 * It fetches data from IndexedDB and renders client component references.
 */

import type { Server, Metric, LogEntry, LogLevel } from "@/db/schema";
import type { ChartDataPoint } from "./types";
import { parseTimeRange, formatPresetLabel } from "@/utilities/timeRange";

// Client component references will be injected by the SW
type ClientRefs = {
  ServerSelectorWrapper: React.ComponentType<{ server: Server | null }>;
  ChartCard: React.ComponentType<{ title: string; data: ChartDataPoint; color: string }>;
  LogTimestampButton: React.ComponentType<{ timestamp: number; log: LogEntry }>;
  LogViewAtTimeButton: React.ComponentType<{ onPress: () => void }>;
  LoadMoreButton: React.ComponentType<{ onPress: () => void }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Server Body (Main RSC)
// ─────────────────────────────────────────────────────────────────────────────

export function ServerBody({
  Client,
  server,
  metrics,
  logs,
  logsTotal,
  startTime,
  endTime,
  range,
}: {
  Client: ClientRefs;
  server: Server | null;
  servers: Server[];
  metrics: Metric[];
  logs: LogEntry[];
  logsTotal: number;
  services: string[];
  startTime: number;
  endTime: number;
  range: string;
}) {
  if (!server) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-muted-foreground">No server selected</span>
      </div>
    );
  }

  const chartData = prepareChartData(metrics);
  const keyMetrics = calculateKeyMetrics(logs, metrics, startTime, endTime);
  const requestVolumeData = prepareRequestVolumeChart(logs, startTime, endTime);
  const errorDistributionData = prepareErrorDistributionChart(logs, startTime, endTime);

  return (
    <div className="flex flex-col gap-6 p-6 overflow-auto">
      <TimeRangeDisplaySection startTime={startTime} endTime={endTime} range={range} />

      <KeyMetricsSection metrics={keyMetrics} />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Client.ChartCard
          title="Request Volume"
          data={requestVolumeData}
          color="rgba(102, 204, 255, 1)"
        />
        <Client.ChartCard
          title="Error Distribution"
          data={errorDistributionData}
          color="rgba(255, 102, 102, 1)"
        />
      </section>

      <LogsSection Client={Client} logs={logs} logsTotal={logsTotal} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Time Range Display Section
// ─────────────────────────────────────────────────────────────────────────────

function TimeRangeDisplaySection({
  startTime,
  endTime,
  range,
}: {
  startTime: number;
  endTime: number;
  range: string;
}) {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const preset = parseTimeRange(range);
  const presetLabel = preset
    ? range in
      {
        last_5m: true,
        last_15m: true,
        last_30m: true,
        last_1h: true,
        last_6h: true,
        last_12h: true,
        last_24h: true,
        last_72h: true,
      }
      ? formatPresetLabel(range as any)
      : null
    : null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-foreground">Time Range Selection</h2>
      <p className="text-sm text-muted-foreground">
        Currently viewing data from {formatDate(startDate)} to {formatDate(endDate)}
      </p>
      {presetLabel && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Preset: {presetLabel}</span>
          <span>Refresh count: 0</span>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Key Metrics Section
// ─────────────────────────────────────────────────────────────────────────────

interface KeyMetrics {
  requests: { value: string; change: string; isPositive: boolean };
  errorRate: { value: string; change: string; isPositive: boolean };
  latency: { value: string; change: string; isPositive: boolean };
  dataTransfer: { value: string; change: string; isPositive: boolean };
}

function calculateKeyMetrics(
  logs: LogEntry[],
  metrics: Metric[],
  startTime: number,
  endTime: number,
): KeyMetrics {
  // Calculate requests (log entries count)
  const requestCount = logs.length;
  const prevPeriodStart = startTime - (endTime - startTime);
  const prevPeriodCount = Math.floor(requestCount * 0.9); // Mock previous period
  const requestChange = ((requestCount - prevPeriodCount) / prevPeriodCount) * 100;

  // Calculate error rate
  const errorLogs = logs.filter((l) => l.level === "error" || l.level === "critical").length;
  const errorRate = logs.length > 0 ? (errorLogs / logs.length) * 100 : 0;
  const prevErrorRate = errorRate * 1.05; // Mock previous period
  const errorRateChange = errorRate - prevErrorRate;

  // Calculate latency (p99) - mock from network metrics
  const avgLatency =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.networkIn + m.networkOut) / 2, 0) / metrics.length
      : 142;
  const latencyMs = Math.round(avgLatency);
  const prevLatency = latencyMs - 8;
  const latencyChange = latencyMs - prevLatency;

  // Calculate data transfer
  const totalBytes = metrics.reduce((sum, m) => sum + m.networkIn + m.networkOut, 0);
  const dataTransferGB = totalBytes / (1024 * 1024 * 1024);
  const prevDataTransferGB = dataTransferGB - 0.25;
  const dataTransferChangeGB = dataTransferGB - prevDataTransferGB;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toFixed(0);
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} TB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} GB`;
    return `${(bytes / 1024).toFixed(1)} MB`;
  };

  return {
    requests: {
      value: formatNumber(requestCount),
      change: `${requestChange >= 0 ? "+" : ""}${requestChange.toFixed(1)}%`,
      isPositive: requestChange >= 0,
    },
    errorRate: {
      value: `${errorRate.toFixed(2)}%`,
      change: `${errorRateChange >= 0 ? "+" : ""}${errorRateChange.toFixed(2)}%`,
      isPositive: errorRateChange < 0,
    },
    latency: {
      value: `${latencyMs}ms`,
      change: `${latencyChange >= 0 ? "+" : ""}${latencyChange}ms`,
      isPositive: latencyChange < 0,
    },
    dataTransfer: {
      value: formatBytes(totalBytes),
      change: `+${formatBytes(dataTransferChangeGB * 1024 * 1024 * 1024)}`,
      isPositive: true,
    },
  };
}

function KeyMetricsSection({ metrics }: { metrics: KeyMetrics }) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Requests"
        value={metrics.requests.value}
        change={metrics.requests.change}
        isPositive={metrics.requests.isPositive}
        icon={
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
        }
      />
      <MetricCard
        label="Error Rate"
        value={metrics.errorRate.value}
        change={metrics.errorRate.change}
        isPositive={metrics.errorRate.isPositive}
        icon={
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 12l4-4 4 4 4-4 4 4" />
            <path d="M3 20l4-4 4 4 4-4 4 4" />
          </svg>
        }
      />
      <MetricCard
        label="Latency (p99)"
        value={metrics.latency.value}
        change={metrics.latency.change}
        isPositive={metrics.latency.isPositive}
        icon={
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        }
      />
      <MetricCard
        label="Data Transfer"
        value={metrics.dataTransfer.value}
        change={metrics.dataTransfer.change}
        isPositive={metrics.dataTransfer.isPositive}
        icon={
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        }
      />
    </section>
  );
}

function MetricCard({
  label,
  value,
  change,
  isPositive,
  icon,
}: {
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-semibold text-foreground">{value}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`text-sm font-medium ${isPositive ? "text-success" : "text-danger"}`}>
          {change}
        </span>
        <span className="text-muted-foreground" aria-hidden="true">
          {isPositive ? "↑" : "↓"}
        </span>
      </div>
    </div>
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
      <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-base font-semibold text-foreground">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart Data Preparation
// ─────────────────────────────────────────────────────────────────────────────

function prepareChartData(metrics: Metric[]): {
  cpu: ChartDataPoint;
  memory: ChartDataPoint;
  networkIn: ChartDataPoint;
  networkOut: ChartDataPoint;
} {
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

function prepareRequestVolumeChart(
  logs: LogEntry[],
  startTime: number,
  endTime: number,
): ChartDataPoint {
  const duration = endTime - startTime;
  if (duration <= 0 || logs.length === 0) {
    return { labels: [], values: [] };
  }

  const buckets = Math.min(20, Math.max(5, Math.floor(logs.length / 10)));
  const bucketSize = duration / buckets;
  const bucketCounts = new Array(buckets).fill(0);

  logs.forEach((log) => {
    const bucketIndex = Math.min(Math.floor((log.timestamp - startTime) / bucketSize), buckets - 1);
    if (bucketIndex >= 0 && bucketIndex < buckets) {
      bucketCounts[bucketIndex]++;
    }
  });

  // Create labels - show first, last, and a few in between
  const labels = bucketCounts.map((_, i) => {
    const bucketStart = startTime + i * bucketSize;
    if (i === 0) {
      return new Date(bucketStart).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (i === buckets - 1) {
      return "Now";
    }
    // Show label every ~5 buckets
    if (buckets > 10 && i % Math.floor(buckets / 4) === 0) {
      return new Date(bucketStart).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return "";
  });

  return { labels, values: bucketCounts };
}

function prepareErrorDistributionChart(
  logs: LogEntry[],
  startTime: number,
  endTime: number,
): ChartDataPoint {
  const duration = endTime - startTime;
  const errorLogs = logs.filter((log) => log.level === "error" || log.level === "critical");

  if (duration <= 0 || errorLogs.length === 0) {
    return { labels: [], values: [] };
  }

  const buckets = Math.min(20, Math.max(5, Math.floor(errorLogs.length / 5) || 10));
  const bucketSize = duration / buckets;
  const bucketCounts = new Array(buckets).fill(0);

  errorLogs.forEach((log) => {
    const bucketIndex = Math.min(Math.floor((log.timestamp - startTime) / bucketSize), buckets - 1);
    if (bucketIndex >= 0 && bucketIndex < buckets) {
      bucketCounts[bucketIndex]++;
    }
  });

  // Create labels - show first, last, and a few in between
  const labels = bucketCounts.map((_, i) => {
    const bucketStart = startTime + i * bucketSize;
    if (i === 0) {
      return new Date(bucketStart).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (i === buckets - 1) {
      return "Now";
    }
    // Show label every ~5 buckets
    if (buckets > 10 && i % Math.floor(buckets / 4) === 0) {
      return new Date(bucketStart).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return "";
  });

  return { labels, values: bucketCounts };
}

// ─────────────────────────────────────────────────────────────────────────────
// Logs Section (Server-rendered table)
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "bg-primary/10 text-primary/60",
  info: "bg-info/10 text-info",
  warn: "bg-warning/10 text-warning",
  error: "bg-danger/10 text-danger",
  critical: "bg-danger/20 text-danger font-bold",
};

function LogsSection({
  Client,
  logs,
  logsTotal,
}: {
  Client: ClientRefs;
  logs: LogEntry[];
  logsTotal: number;
}) {
  const errorCount = logs.filter((l) => l.level === "error" || l.level === "critical").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;
  const hasMore = logs.length < logsTotal;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <span className="text-sm text-foreground">Total: {logsTotal}</span>
          {errorCount > 0 && <span className="text-sm text-destructive">Errors: {errorCount}</span>}
          {warnCount > 0 && (
            <span className="text-sm text-accent-foreground">Warnings: {warnCount}</span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-150">
            <thead className="bg-primary/5 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Time
                  </span>
                </th>
                <th className="px-3 py-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Level
                  </span>
                </th>
                <th className="px-3 py-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Service
                  </span>
                </th>
                <th className="px-3 py-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Message
                  </span>
                </th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <LogTableRow key={log.id} Client={Client} log={log} />
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center">
                    <span className="text-muted-foreground">No logs found</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="flex items-center justify-between p-3 border-t border-border">
            <span className="text-sm text-foreground">
              Showing {logs.length} of {logsTotal} logs
            </span>
            <Client.LoadMoreButton onPress={() => {}} />
          </div>
        )}
      </div>
    </section>
  );
}

function LogTableRow({ Client, log }: { Client: ClientRefs; log: LogEntry }) {
  return (
    <tr className="hover:bg-hover-bg transition-colors border-b border-border last:border-b-0">
      <td className="px-3 py-2 whitespace-nowrap">
        <Client.LogTimestampButton timestamp={log.timestamp} log={log} />
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${LEVEL_COLORS[log.level]}`}
        >
          {log.level}
        </span>
      </td>
      <td className="px-3 py-2">
        {log.service ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary/80">
            {log.service}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="text-sm line-clamp-2 text-foreground">{log.message}</span>
      </td>
      <td className="px-3 py-2">
        <Client.LogViewAtTimeButton onPress={() => {}} />
      </td>
    </tr>
  );
}
