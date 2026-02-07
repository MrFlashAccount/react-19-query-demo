/**
 * Client Components for Server Page
 *
 * These components are interactive and will be referenced from RSC.
 */

import { Button, Dialog, DialogTrigger, Text, Tooltip } from "@/components/AriaComponents";
import { ServerSelector } from "./ServerSelectorPopover";
import type { LogEntry, LogLevel, Server } from "@/db/schema";
import { ChartGPUChart } from "chartgpu-react";
import type { ChartGPUOptions } from "chartgpu";
import type { ChartDataPoint } from "./types";
import { ChevronsUpDown } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Server Selector Wrapper
// ─────────────────────────────────────────────────────────────────────────────

export function ServerSelectorWrapper({ server }: { server: Server | null }) {
  return (
    <ServerSelector
      triggerButton={
        <Button variant="outline" size="medium" icon={<ChevronsUpDown />} iconPosition="end">
          <span
            style={{
              textBoxTrim: "trim-both",
              textBoxEdge: "cap alphabetic",
            }}
          >
            {server?.name ?? "Select Server"}
          </span>
        </Button>
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart Components
// ─────────────────────────────────────────────────────────────────────────────

function colorWithAlpha(cssColor: string, alpha: number): string {
  if (cssColor.startsWith("rgba(")) {
    return cssColor.replace(/[\d.]+\)\s*$/, `${alpha})`);
  }
  if (cssColor.startsWith("rgb(")) {
    return cssColor.replace("rgb(", "rgba(").replace(/\)\s*$/, `, ${alpha})`);
  }
  return cssColor;
}

export function ChartCard({
  title,
  data,
  color,
}: {
  title: string;
  data: ChartDataPoint;
  color: string;
}) {
  const isBarChart = title === "Request Volume" || title === "Error Distribution";

  if (
    !data ||
    !data.labels ||
    !data.values ||
    data.labels.length === 0 ||
    data.values.length === 0
  ) {
    return (
      <div className="rounded-lg border border-border bg-background/60 p-4 backdrop-blur-sm">
        <Text variant="body" weight="semibold" className="mb-2 block text-wrap-balance">
          {title}
        </Text>
        <div className="h-48 flex items-center justify-center">
          <Text variant="body-sm" color="muted">
            No data available
          </Text>
        </div>
      </div>
    );
  }

  const minLength = Math.min(data.labels.length, data.values.length);
  const values = data.values
    .slice(0, minLength)
    .map((v) => (typeof v === "number" && !isNaN(v) ? v : 0));
  const chartData: [number, number][] = values.map((y, i) => [i, y]);

  const options = {
    theme: "light",
    series: [
      isBarChart
        ? { type: "bar", name: title, data: chartData, color }
        : {
            type: "line",
            name: title,
            data: chartData,
            lineStyle: { color, width: 2 },
            areaStyle: { color: colorWithAlpha(color, 0.1) },
          },
    ],
    xAxis: { type: "value" },
    yAxis: { type: "value", min: isBarChart ? 0 : undefined },
    grid: { left: 48, right: 16, top: 16, bottom: 32 },
    tooltip: { show: true },
  } satisfies ChartGPUOptions;

  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <Text variant="body" weight="semibold" className="mb-2 block text-wrap-balance">
        {title}
      </Text>

      <div className="h-48" role="img" aria-label={`${title} chart`}>
        <ChartGPUChart options={options} style={{ width: "100%", height: "192px" }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Logs Components
// ─────────────────────────────────────────────────────────────────────────────

export function LogTimestampButton({ timestamp, log }: { timestamp: number; log: LogEntry }) {
  return (
    <DialogTrigger>
      <Button variant="ghost" size="xsmall">
        {new Date(timestamp).toLocaleTimeString()}
      </Button>

      <Dialog type="sheet" size="large" title="Log Entry Details">
        {() => <LogDetailContent log={log} />}
      </Dialog>
    </DialogTrigger>
  );
}

export function LogViewAtTimeButton({ onPress }: { onPress: () => void }) {
  return (
    <Tooltip placement="left">
      <Button variant="ghost" size="xsmall" onPress={onPress}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </Button>
      <Text variant="body-sm">View at this time</Text>
    </Tooltip>
  );
}

function LogDetailContent({ log }: { log: LogEntry }) {
  const levelColors: Record<LogLevel, string> = {
    debug: "bg-primary/10 text-primary/70 border-primary/20",
    info: "bg-info/10 text-info border-info/30",
    warn: "bg-warning/10 text-warning border-warning/30",
    error: "bg-danger/10 text-danger border-danger/30",
    critical: "bg-danger/20 text-danger border-danger/40 font-bold",
  };

  const levelLabels: Record<LogLevel, string> = {
    debug: "Debug",
    info: "Info",
    warn: "Warning",
    error: "Error",
    critical: "Critical",
  };

  const dateTime = new Date(log.timestamp);
  const metadataJson = log.metadata ? JSON.stringify(log.metadata, null, 2) : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-md border px-2.5 py-1 ${levelColors[log.level]}`}
        >
          <Text variant="body-sm" weight="semibold" className="uppercase">
            {levelLabels[log.level]}
          </Text>
        </span>
        <Text variant="body-sm" color="muted">
          {dateTime.toLocaleString()}
        </Text>
      </div>

      <div className="flex flex-col gap-2">
        <Text variant="overline" color="muted">
          Message
        </Text>
        <div className="rounded-lg border border-border bg-primary/5 p-3">
          <Text variant="body" className="whitespace-pre-wrap wrap-break-word">
            {log.message}
          </Text>
        </div>
      </div>

      {log.service && (
        <div className="flex flex-col gap-2">
          <Text variant="overline" color="muted">
            Service
          </Text>
          <Text variant="body">{log.service}</Text>
        </div>
      )}

      {metadataJson && (
        <div className="flex flex-col gap-2">
          <Text variant="overline" color="muted">
            Metadata
          </Text>
          <div className="rounded-lg border border-border bg-primary/5 p-3">
            <pre className="text-xs font-mono text-primary/80 whitespace-pre-wrap wrap-break-word overflow-x-auto">
              {metadataJson}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function LoadMoreButton({ onPress }: { onPress: () => void }) {
  return (
    <Button variant="outline" size="small" onPress={onPress}>
      Load More
    </Button>
  );
}
