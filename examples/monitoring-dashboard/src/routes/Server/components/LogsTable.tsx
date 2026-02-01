import { useState, use, useCallback } from "react";
import {
  Button,
  Text,
  Dialog,
  DialogTrigger,
  Tooltip,
  Form,
  Input,
} from "@/components/AriaComponents";
import type { LogEntry, LogLevel } from "@/db/schema";
import { logsQuery } from "@/queries";
import { useQuery } from "@lib/goat-query/react";
import { z } from "zod";

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error", "critical"];
const TIME_PRESETS = [
  { label: "15 min", value: 15 * 60 * 1000 },
  { label: "1 hour", value: 60 * 60 * 1000 },
  { label: "6 hours", value: 6 * 60 * 60 * 1000 },
  { label: "24 hours", value: 24 * 60 * 60 * 1000 },
  { label: "7 days", value: 7 * 24 * 60 * 60 * 1000 },
];

const logsFilterSchema = z.object({
  search: z.string(),
  service: z.string(),
  levels: z.array(z.enum(["debug", "info", "warn", "error", "critical"])),
  timeRange: z.number().optional(),
});

type FilterValues = z.infer<typeof logsFilterSchema>;

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "bg-primary/10 text-primary/60",
  info: "bg-info/10 text-info",
  warn: "bg-warning/10 text-warning",
  error: "bg-danger/10 text-danger",
  critical: "bg-danger/20 text-danger font-bold",
};

const LEVEL_DOT_COLORS: Record<LogLevel, string> = {
  debug: "bg-primary/50",
  info: "bg-info",
  warn: "bg-warning",
  error: "bg-danger",
  critical: "bg-danger",
};

interface LogsTableProps {
  serverId: string;
  startTime: number;
  endTime: number;
  onTimeRangeChange?: (startTime: number, endTime: number) => void;
  onViewAtTime?: (timestamp: number) => void;
}

export function LogsTable({
  serverId,
  startTime,
  endTime,
  onTimeRangeChange,
  onViewAtTime,
}: LogsTableProps) {
  // Filters state managed by parent
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    service: "",
    levels: [],
    timeRange: undefined,
  });
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Handle filter submission from form
  const handleFiltersSubmit = useCallback(
    (values: FilterValues) => {
      setFilters(values);

      // If time range is selected, trigger time range change
      if (values.timeRange) {
        const newEndTime = Date.now();
        const newStartTime = newEndTime - values.timeRange;
        onTimeRangeChange?.(newStartTime, newEndTime);
        setOffset(0);
      }
    },
    [onTimeRangeChange],
  );

  // Handle load more
  const handleLoadMore = useCallback(() => {
    setLimit((prev) => prev + 50);
  }, []);

  // Handle view at time
  const handleViewAtTime = useCallback(
    (timestamp: number) => {
      onViewAtTime?.(timestamp);
    },
    [onViewAtTime],
  );

  const { promise } = useQuery({
    query: logsQuery,
    params: {
      serverId,
      startTime,
      endTime,
      limit,
      offset,
      level: filters.levels.length > 0 ? filters.levels[0] : undefined,
      search: filters.search || undefined,
    },
  });

  const { logs, total } = use(promise);

  const services = [
    ...new Set(logs.map((log) => log.service).filter((s): s is string => Boolean(s))),
  ];

  // Filter logs locally based on current filters
  const filteredLogs = logs.filter((log) => {
    if (filters.levels.length > 0 && !filters.levels.includes(log.level)) return false;
    if (filters.service && log.service !== filters.service) return false;
    if (filters.search) {
      const query = filters.search.toLowerCase();
      return (
        log.message.toLowerCase().includes(query) ||
        JSON.stringify(log.metadata).toLowerCase().includes(query)
      );
    }
    return true;
  });

  const errorCount = logs.filter((l) => l.level === "error" || l.level === "critical").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;

  return (
    <section className="flex flex-col gap-4">
      <LogFilters services={services} filters={filters} onSubmit={handleFiltersSubmit} />

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Text variant="body-sm">Total: {total}</Text>
          {errorCount > 0 && (
            <Text variant="body-sm" color="danger">
              Errors: {errorCount}
            </Text>
          )}
          {warnCount > 0 && (
            <Text variant="body-sm" color="accent">
              Warnings: {warnCount}
            </Text>
          )}
        </div>
      </div>

      <LogTable
        logs={filteredLogs}
        total={total}
        hasMore={filteredLogs.length < total}
        onLoadMore={handleLoadMore}
        onViewAtTime={handleViewAtTime}
      />
    </section>
  );
}

interface LogFiltersProps {
  services: string[];
  filters: FilterValues;
  onSubmit: (values: FilterValues) => void;
}

function LogFilters({ services, filters, onSubmit }: LogFiltersProps) {
  const form = Form.useForm({
    schema: logsFilterSchema,
    defaultValues: filters,
    onSubmit,
    onChange: () => {
      console.log("onChange");
      // void form.submit(null);
    },
  });

  // Toggle level in form
  const toggleLevel = (level: LogLevel) => {
    const currentLevels = form.getValues("levels") ?? [];
    if (currentLevels.includes(level)) {
      form.setValue(
        "levels",
        currentLevels.filter((l) => l !== level),
      );
    } else {
      form.setValue("levels", [...currentLevels, level]);
    }
  };

  // Set time range in form
  const setTimeRange = (duration: number) => {
    form.setValue("timeRange", duration);
  };

  return (
    <Form form={form}>
      <div className="flex flex-wrap items-center gap-3 p-3 bg-background/60 rounded-lg border border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <Form.FieldValue form={form} name="levels">
            {(values) =>
              LOG_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleLevel(level)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                    values.includes(level)
                      ? "bg-primary/10 border-primary/30"
                      : "bg-background border-border hover:border-primary/20"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${LEVEL_DOT_COLORS[level]}`} />
                  <Text variant="body-sm" className="capitalize">
                    {level}
                  </Text>
                </button>
              ))
            }
          </Form.FieldValue>
        </div>

        {services.length > 0 && (
          <Form.Field name="service" label="">
            {(fieldProps) => (
              <select
                {...fieldProps}
                className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              >
                <option value="">All Services</option>
                {services.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            )}
          </Form.Field>
        )}

        <div className="flex items-center gap-1">
          {TIME_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="ghost"
              size="xsmall"
              onPress={() => setTimeRange(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-50">
          <Input form={form} name="search" placeholder="Search logs..." rounded="large" />
        </div>
      </div>

      <Form.Submit />

      <Form.FormError />
    </Form>
  );
}

interface LogTableProps {
  logs: LogEntry[];
  total: number;
  hasMore: boolean;
  onLoadMore: () => void;
  onViewAtTime: (timestamp: number) => void;
}

function LogTable({ logs, total, hasMore, onLoadMore, onViewAtTime }: LogTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-150">
          <thead className="bg-primary/5 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2">
                <Text variant="overline" color="muted">
                  Time
                </Text>
              </th>
              <th className="px-3 py-2">
                <Text variant="overline" color="muted">
                  Level
                </Text>
              </th>
              <th className="px-3 py-2">
                <Text variant="overline" color="muted">
                  Service
                </Text>
              </th>
              <th className="px-3 py-2">
                <Text variant="overline" color="muted">
                  Message
                </Text>
              </th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <LogTableRow
                key={log.id}
                log={log}
                onViewAtTime={() => onViewAtTime(log.timestamp)}
              />
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center">
                  <Text color="muted">No logs found</Text>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="flex items-center justify-between p-3 border-t border-border">
          <Text variant="body-sm">
            Showing {logs.length} of {total} logs
          </Text>
          <Button variant="outline" size="small" onPress={onLoadMore}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}

interface LogTableRowProps {
  log: LogEntry;
  onViewAtTime: () => void;
}

function LogTableRow({ log, onViewAtTime }: LogTableRowProps) {
  return (
    <tr className="hover:bg-hover-bg transition-colors border-b border-border last:border-b-0">
      <td className="px-3 py-2 whitespace-nowrap">
        <DialogTrigger>
          <Button variant="ghost" size="xsmall">
            {new Date(log.timestamp).toLocaleTimeString()}
          </Button>

          <Dialog type="sheet" size="large" title="Log Entry Details">
            <LogDetailContent log={log} />
          </Dialog>
        </DialogTrigger>
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
          <Text variant="body-sm" color="muted">
            —
          </Text>
        )}
      </td>
      <td className="px-3 py-2">
        <Text variant="body-sm" truncate="2">
          {log.message}
        </Text>
      </td>
      <td className="px-3 py-2">
        <Tooltip placement="left">
          <Button variant="ghost" size="xsmall" onPress={onViewAtTime}>
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
      </td>
    </tr>
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
