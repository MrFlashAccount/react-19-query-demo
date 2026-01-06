import type { SpanStartEvent, SpanEndEvent, SpanEvent, Color } from "../types";
import { BaseReporter } from "./BaseReporter";

const colorToHex: Record<Color, `#${string}`> = {
  primary: "#3b82f6",
  "primary-light": "#60a5fa",
  "primary-dark": "#2563eb",
  secondary: "#8b5cf6",
  "secondary-light": "#a78bfa",
  "secondary-dark": "#7c3aed",
  tertiary: "#06b6d4",
  "tertiary-light": "#2dd4bf",
  "tertiary-dark": "#0e7490",
  error: "#ef4444",
};

const StatusStyle = {
  success: {
    color: "#10b981", // emerald
    bg: "#064e3b", // dark emerald bg
    icon: "✅",
  },
  error: {
    color: "#ef4444", // red
    bg: "#7f1d1d", // dark red bg
    icon: "❌",
  },
} as const;

const Icons = {
  start: "▶",
  event: "◆",
  muted: "│",
} as const;

const UIColors = {
  timestamp: "#9ca3af",
  muted: "#6b7280",
  description: "#a1a1aa",
} as const;

export interface LoggerReporterOptions {
  /**
   * Whether to show payload details in logs
   * @default false
   */
  showPayloadDetails?: boolean;
  /**
   * Whether to use console.group for nested logging
   * @default true
   */
  useGrouping?: boolean;
  /**
   * Maximum nesting depth for console groups
   * Spans beyond this depth are logged flat
   * @default 8
   */
  maxDepth?: number;
  /**
   * Whether to show span metadata summary on span end
   * Includes: duration, start time, end time, and accumulated payload
   * @default false
   */
  showEndMetadata?: boolean;
}

/**
 * Reporter that logs trace events to the console.
 */
export class LoggerReporter extends BaseReporter {
  private readonly loggerOptions: Required<LoggerReporterOptions>;
  private readonly spanDepths = new Map<string, number>();

  constructor(options: LoggerReporterOptions = {}) {
    super({ useBatching: true });

    this.loggerOptions = {
      showPayloadDetails: options.showPayloadDetails ?? false,
      useGrouping: options.useGrouping ?? true,
      maxDepth: options.maxDepth ?? 8,
      showEndMetadata: options.showEndMetadata ?? true,
    };
  }

  protected override onStop(): void {
    this.spanDepths.clear();
  }

  protected onSpanStart(event: SpanStartEvent): void {
    this.trackSpanStart(event);

    // Calculate and store depth
    const parentDepth = event.parentSpan
      ? this.spanDepths.get(event.parentSpan.spanId) ?? 0
      : 0;
    const depth = parentDepth + 1;
    this.spanDepths.set(event.span.spanId, depth);

    const { description, color } = event.span.meta;
    const hexColor = colorToHex[color ?? "primary"];
    const withinDepthLimit = depth <= this.loggerOptions.maxDepth;

    // Open console group if within depth limit
    if (this.loggerOptions.useGrouping && withinDepthLimit) {
      const method =
        event.parentSpan === undefined ? "groupCollapsed" : "group";
      const descPart = description ? ` — ${description}` : "";

      console[method](
        `%c${event.span.name}%c${descPart}`,
        `color: ${hexColor}; font-weight: bold;`,
        `color: ${UIColors.description}; font-weight: normal;`
      );
    }

    // Log start event
    this.logSpanStart(event, depth);
  }

  protected onSpanEnd(event: SpanEndEvent): void {
    const metrics = this.untrackSpan(event.span.spanId);
    const depth = this.spanDepths.get(event.span.spanId) ?? 1;
    this.spanDepths.delete(event.span.spanId);

    if (!metrics) return;

    const duration = event.timestamp - metrics.startedAt;
    const withinDepthLimit = depth <= this.loggerOptions.maxDepth;

    // Log end event
    this.logSpanEnd(event, duration, metrics.startedAt, depth);

    // Close console group
    if (this.loggerOptions.useGrouping && withinDepthLimit) {
      console.groupEnd();
    }
  }

  protected onSpanEvent(event: SpanEvent): void {
    const metrics = this.getSpanMetrics(event.span.spanId);
    if (!metrics) return;

    const elapsed = event.timestamp - metrics.startedAt;

    this.recordSpanEvent(event);

    const depth = this.spanDepths.get(event.span.spanId) ?? 1;
    const indent = this.getIndent(depth);

    console.log(
      `%c${indent}${Icons.event} ${event.eventName} %c+${elapsed.toFixed(2)}ms`,
      `color: ${UIColors.muted}; font-weight: bold;`,
      `color: ${UIColors.timestamp}; font-size: 0.9em;`
    );

    if (this.loggerOptions.showPayloadDetails && event.payload) {
      this.logPayload(event.payload, indent);
    }
  }

  private logSpanStart(event: SpanStartEvent, depth: number): void {
    const { color } = event.span.meta;
    const hexColor = colorToHex[color ?? "primary"];
    const indent = this.getIndent(depth);

    console.log(
      `%c${indent}${Icons.start} Started %c+0.00ms`,
      `color: ${hexColor}; font-weight: bold;`,
      `color: ${UIColors.timestamp}; font-size: 0.9em;`
    );

    if (this.loggerOptions.showPayloadDetails && event.payload) {
      this.logPayload(event.payload, indent);
    }
  }

  private logSpanEnd(
    event: SpanEndEvent,
    duration: number,
    startedAt: number,
    depth: number
  ): void {
    const indent = this.getIndent(depth);
    const style = StatusStyle[event.status];
    const statusLabel = event.status === "success" ? "Completed" : "Failed";

    // Custom styling for success/error
    console.log(
      `%c${indent}${style.icon} ${statusLabel} %c+${duration.toFixed(2)}ms`,
      `color: ${style.color}; font-weight: bold;`,
      `color: ${UIColors.timestamp}; font-size: 0.9em;`
    );

    if (event.status === "error" && event.error) {
      console.error(`${indent}  Error:`, event.error);
    }

    if (this.loggerOptions.showPayloadDetails && event.payload) {
      this.logPayload(event.payload, indent);
    }

    // Show metadata summary on span end
    if (this.loggerOptions.showEndMetadata) {
      this.logEndMetadata(event, duration, startedAt, indent);
    }
  }

  private logEndMetadata(
    event: SpanEndEvent,
    duration: number,
    startedAt: number,
    indent: string
  ): void {
    const metadata: Record<string, unknown> = {
      name: event.span.name,
      status: event.status,
      duration: `${duration.toFixed(2)}ms`,
      startTime: new Date(startedAt).toISOString(),
      endTime: new Date(event.timestamp).toISOString(),
    };

    if (event.span.meta.description) {
      metadata.description = event.span.meta.description;
    }

    if (event.payload && Object.keys(event.payload).length > 0) {
      metadata.payload = event.span.payload;
    }

    if (event.status === "error" && event.error) {
      metadata.error = event.error;
    }

    console.groupCollapsed(
      `%c${indent}📊 Span Metadata`,
      `color: ${UIColors.muted}; font-weight: bold;`
    );
    console.table(metadata);
    console.groupEnd();
  }

  private logPayload(payload: Record<string, unknown>, indent: string): void {
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) {
        console.log(`${indent}  ${key}:`, value);
      }
    }
  }

  /**
   * Generate indentation string based on depth
   * Only used when grouping is disabled or depth exceeds max
   */
  private getIndent(depth: number): string {
    if (
      this.loggerOptions.useGrouping &&
      depth <= this.loggerOptions.maxDepth
    ) {
      return "";
    }

    return `${Icons.muted} `.repeat(
      Math.min(depth - 1, this.loggerOptions.maxDepth)
    );
  }
}
