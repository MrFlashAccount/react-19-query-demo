import { useState } from "react";
import { Button, Text, CopyBlock, Separator } from "@/components/AriaComponents";
import type { LogEntry, LogLevel } from "@/db/schema";
import { logsQuery } from "@/queries";
import { useQuery } from "@lib/goat-query/react";
import { tv } from "@/utilities/tailwindVariants";

const LOG_DETAIL_STYLES = tv({
  slots: {
    container: "flex flex-col gap-4 p-4",
    levelBadge: "inline-flex items-center rounded-md border px-2.5 py-1",
    section: "flex flex-col gap-2",
    codeBlock: "rounded-lg border border-border bg-primary/5 p-3 overflow-x-auto",
    relatedLogs: "flex flex-col gap-2 mt-4",
    relatedLogItem:
      "flex items-center gap-2 p-2 rounded-lg hover:bg-hover-bg cursor-pointer transition-colors",
    navButtons: "flex items-center gap-2 mt-4",
  },
  variants: {
    level: {
      debug: { levelBadge: "bg-primary/10 text-primary/70 border-primary/20" },
      info: { levelBadge: "bg-info/10 text-info border-info/30" },
      warn: { levelBadge: "bg-warning/10 text-warning border-warning/30" },
      error: { levelBadge: "bg-danger/10 text-danger border-danger/30" },
      critical: { levelBadge: "bg-danger/20 text-danger border-danger/40 font-bold" },
    },
  },
});

interface LogDetailDialogProps {
  log: LogEntry;
  serverId: string;
  onNavigate?: (log: LogEntry) => void;
  onViewAtTime?: (timestamp: number) => void;
}

export function LogDetailDialog({ log, serverId, onNavigate, onViewAtTime }: LogDetailDialogProps) {
  const styles = LOG_DETAIL_STYLES({ level: log.level });
  const [showRelated, setShowRelated] = useState(false);

  const levelLabels: Record<LogLevel, string> = {
    debug: "Debug",
    info: "Info",
    warn: "Warning",
    error: "Error",
    critical: "Critical",
  };

  const dateTime = new Date(log.timestamp);
  const formattedDate = dateTime.toLocaleDateString([], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = dateTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const relativeTime = formatRelativeTime(log.timestamp);

  const metadataJson = log.metadata ? JSON.stringify(log.metadata, null, 2) : null;

  // Fetch related logs (5 before and 5 after)
  const { promise: relatedPromise } = useQuery({
    query: logsQuery,
    params: {
      serverId,
      startTime: log.timestamp - 60000, // 1 minute before
      endTime: log.timestamp + 60000, // 1 minute after
      limit: 11,
      level: log.level,
    },
  });
  const { logs: relatedLogs } = use(relatedPromise);

  const currentIndex = relatedLogs.findIndex((l) => l.id === log.id);
  const prevLog = currentIndex > 0 ? relatedLogs[currentIndex - 1] : null;
  const nextLog = currentIndex < relatedLogs.length - 1 ? relatedLogs[currentIndex + 1] : null;

  const handleViewAtTime = () => {
    onViewAtTime?.(log.timestamp);
  };

  const handleNavigate = (targetLog: LogEntry) => {
    onNavigate?.(targetLog);
  };

  return (
    <div className={styles.container()}>
      {/* Level Badge */}
      <div className="flex items-center gap-3">
        <span className={styles.levelBadge()}>
          <Text variant="body-sm" weight="semibold" className="uppercase">
            {levelLabels[log.level]}
          </Text>
        </span>
        <Text variant="body-sm" color="muted">
          {relativeTime}
        </Text>
      </div>

      <Separator />

      {/* Message */}
      <div className={styles.section()}>
        <Text variant="overline" color="muted">
          Message
        </Text>
        <div className={styles.codeBlock()}>
          <Text variant="body" className="whitespace-pre-wrap wrap-break-word">
            {log.message}
          </Text>
        </div>
      </div>

      {/* Timestamp */}
      <div className={styles.section()}>
        <Text variant="overline" color="muted">
          Timestamp
        </Text>
        <div className="flex flex-col gap-1">
          <Text variant="body">
            {formattedDate} at {formattedTime}
          </Text>
          <Text variant="body-sm" color="muted" className="font-mono">
            {log.timestamp}
          </Text>
        </div>
      </div>

      {/* Service */}
      {log.service && (
        <div className={styles.section()}>
          <Text variant="overline" color="muted">
            Service
          </Text>
          <Text variant="body">{log.service}</Text>
        </div>
      )}

      <Separator />

      {/* Server ID */}
      <div className={styles.section()}>
        <Text variant="overline" color="muted">
          Server ID
        </Text>
        <CopyBlock copyText={serverId} size="medium" rounded="medium" />
      </div>

      {/* Log ID */}
      <div className={styles.section()}>
        <Text variant="overline" color="muted">
          Log ID
        </Text>
        <CopyBlock copyText={log.id} size="medium" rounded="medium" />
      </div>

      {/* Metadata */}
      {metadataJson && (
        <>
          <Separator />
          <div className={styles.section()}>
            <Text variant="overline" color="muted">
              Metadata
            </Text>
            <div className={styles.codeBlock()}>
              <pre className="text-xs font-mono text-primary/80 whitespace-pre-wrap wrap-break-word">
                {metadataJson}
              </pre>
            </div>
            <CopyBlock copyText={metadataJson} size="medium" rounded="medium" />
          </div>
        </>
      )}

      {/* Related Logs Section */}
      <Separator />
      <div className={styles.relatedLogs()}>
        <div className="flex items-center justify-between">
          <Text variant="overline" color="muted">
            Related Logs
          </Text>
          <Button variant="ghost" size="xsmall" onPress={() => setShowRelated(!showRelated)}>
            {showRelated ? "Hide" : "Show"} ({relatedLogs.length - 1} nearby)
          </Button>
        </div>

        {showRelated && (
          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {relatedLogs
              .filter((l) => l.id !== log.id)
              .map((relatedLog) => (
                <div
                  key={relatedLog.id}
                  className={styles.relatedLogItem()}
                  onClick={() => handleNavigate(relatedLog)}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      relatedLog.level === "debug"
                        ? "bg-primary/50"
                        : relatedLog.level === "info"
                          ? "bg-info"
                          : relatedLog.level === "warn"
                            ? "bg-warning"
                            : "bg-danger"
                    }`}
                  />
                  <Text variant="body-sm" className="flex-1 truncate">
                    {new Date(relatedLog.timestamp).toLocaleTimeString()}
                  </Text>
                  <Text variant="body-sm" color="muted" truncate="1">
                    {relatedLog.message}
                  </Text>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Navigation & Actions */}
      <div className={styles.navButtons()}>
        <Button
          variant="outline"
          size="small"
          isDisabled={!prevLog}
          onPress={() => prevLog && handleNavigate(prevLog)}
        >
          ← Previous
        </Button>
        <Button
          variant="outline"
          size="small"
          isDisabled={!nextLog}
          onPress={() => nextLog && handleNavigate(nextLog)}
        >
          Next →
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="small" onPress={handleViewAtTime}>
          View at This Time
        </Button>
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "Just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}

// Helper for use with React.use()
function use<T>(promise: Promise<T>): T {
  const [state, setState] = useState<{ data: T | null; error: Error | null }>({
    data: null,
    error: null,
  });

  useState(() => {
    promise
      .then((data) => setState({ data, error: null }))
      .catch((error) => setState({ data: null, error }));
  });

  if (state.error) throw state.error;
  if (!state.data) throw promise;
  return state.data;
}
