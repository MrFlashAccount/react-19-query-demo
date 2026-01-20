import type {
  SpanStartEvent,
  SpanEndEvent,
  SpanEvent,
  Color,
  TraceEvent,
} from "../types";
import { BaseReporter } from "./BaseReporter";
import type { SpanMetrics } from "./types";

/**
 * Chrome DevTools performance panel detail structure
 */
interface DevtoolsDetail {
  color: string;
  trackGroup: string;
  track: string;
  properties?: Array<[string, string]>;
  tooltip?: string;
}

/**
 * Extended span metrics for DevTools reporter
 */
interface DevtoolsSpanMetrics extends SpanMetrics {
  startMark: string;
}

/**
 * Map Color to DevTools-compatible color names
 * Chrome DevTools understands these semantic color names
 */
const colorToDevtools: Record<Color, string> = {
  primary: "primary",
  "primary-light": "primary-light",
  "primary-dark": "primary-dark",
  secondary: "secondary",
  "secondary-light": "secondary-light",
  "secondary-dark": "secondary-dark",
  tertiary: "tertiary",
  "tertiary-light": "tertiary-light",
  "tertiary-dark": "tertiary-dark",
  error: "error",
};

export interface DevtoolsReporterOptions {
  /**
   * Prefix for performance marks
   * @default "your-app"
   */
  prefix?: string;
  /**
   * Custom track group name
   * @default "Your App"
   */
  trackGroupName?: string;
  /**
   * Custom track name (all spans stack on this single track)
   * @default "Timeline"
   */
  trackName?: string;
}

/**
 * Reporter that creates performance measures for visualization
 * in Chrome DevTools Performance panel.
 *
 * Uses the User Timing API (performance.mark/measure) to create
 * entries that appear in the DevTools timeline.
 */
export class DevtoolsReporter extends BaseReporter {
  private readonly devtoolsSpans = new Map<string, DevtoolsSpanMetrics>();
  private readonly reporterOptions: Required<DevtoolsReporterOptions>;

  constructor(options: DevtoolsReporterOptions = {}) {
    super({ useBatching: true });
    this.reporterOptions = {
      prefix: options.prefix ?? "your-app",
      trackGroupName: options.trackGroupName ?? "Your App",
      trackName: options.trackName ?? "Timeline",
    };
  }

  /**
   * Clear all performance marks and measures created by this reporter
   */
  clearAll(): void {
    const marks = performance.getEntriesByType("mark");
    marks.forEach((entry) => {
      if (entry.name.startsWith(this.reporterOptions.prefix)) {
        performance.clearMarks(entry.name);
      }
    });

    const measures = performance.getEntriesByType("measure");
    measures.forEach((measure) => {
      if (measure.name.startsWith(this.reporterOptions.prefix)) {
        performance.clearMeasures(measure.name);
      }
    });
  }

  protected processEvents(events: TraceEvent[]): void {
    events.forEach((event) => {
      switch (event.kind) {
        case "start":
          this.onSpanStart(event);
          break;

        case "end":
          this.onSpanEnd(event);
          break;
        case "event":
          this.onSpanEvent(event);
          break;
        default:
          break;
      }
    });
  }

  private onSpanStart(event: SpanStartEvent): void {
    const spanId = event.span.spanId;
    const markName = `${this.reporterOptions.prefix}:${spanId}:start`;

    performance.mark(markName);

    const metrics: DevtoolsSpanMetrics = {
      spanId,
      parentSpanId: event.parentSpan?.spanId,
      name: event.name,
      startMark: markName,
      startedAt: event.timestamp,
      payload: event.payload,
      events: [],
    };

    this.devtoolsSpans.set(spanId, metrics);
  }

  protected onSpanEnd(event: SpanEndEvent): void {
    const spanId = event.span.spanId;
    const metrics = this.devtoolsSpans.get(spanId);
    if (!metrics) return;

    const endMark = `${this.reporterOptions.prefix}:${spanId}:end`;
    performance.mark(endMark);

    try {
      const duration = event.timestamp - metrics.startedAt;
      const { description, color } = event.span.meta;

      // Use span name for display
      const measureName = event.span.name;

      performance.measure(measureName, {
        start: metrics.startedAt,
        end: event.timestamp,
        detail: {
          devtools: this.buildDevtoolsDetail(
            event.status,
            color ?? "primary",
            duration,
            description ?? "",
            metrics,
            event
          ),
        },
      });
    } catch (error) {
      console.warn("Failed to create performance measure:", error);
    }

    // Cleanup marks
    this.cleanupMarks(metrics.startMark, endMark);
    this.devtoolsSpans.delete(spanId);
  }

  protected onSpanEvent(event: SpanEvent): void {
    const metrics = this.devtoolsSpans.get(event.span.spanId);
    if (!metrics) return;

    metrics.events.push({
      name: event.eventName,
      timestamp: event.timestamp,
      payload: event.payload,
    });
  }

  private buildDevtoolsDetail(
    status: "success" | "error",
    color: Color,
    duration: number,
    description: string,
    metrics: DevtoolsSpanMetrics,
    endEvent: SpanEndEvent
  ): DevtoolsDetail {
    const properties: Array<[string, string]> = [
      ["Status", status],
      ["Duration", `${duration.toFixed(2)}ms`],
    ];

    // Add description if present
    if (description) {
      properties.unshift(["Description", description]);
    }

    // Add payload properties
    this.addPayloadProperties(properties, metrics.payload);

    // Add end event payload if present
    if (endEvent.payload) {
      this.addPayloadProperties(properties, endEvent.payload);
    }

    // Add error info if present
    if (endEvent.status === "error") {
      properties.push(["Error", this.stringifyValue(endEvent.error)]);
    }

    // Add intermediate events count if any
    if (metrics.events.length > 0) {
      properties.push(["Events", String(metrics.events.length)]);
    }

    // Use error color on failure, otherwise span's color
    const devtoolsColor =
      status === "error" ? colorToDevtools.error : colorToDevtools[color];

    return {
      color: devtoolsColor,
      trackGroup: this.reporterOptions.trackGroupName,
      track: this.reporterOptions.trackName,
      properties,
      tooltip: description || undefined,
    };
  }

  private addPayloadProperties(
    properties: Array<[string, string]>,
    payload: Record<string, unknown>
  ): void {
    for (const [key, value] of Object.entries(payload)) {
      // Skip internal properties
      if (key === "scopeId" || key === "parentScopeId") continue;
      properties.push([this.formatKey(key), this.stringifyValue(value)]);
    }
  }

  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }

  private stringifyValue(value: unknown): string {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (value instanceof Error) {
      return value.message;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private cleanupMarks(startMark: string, endMark: string): void {
    try {
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
    } catch {
      // Ignore cleanup errors
    }
  }
}
