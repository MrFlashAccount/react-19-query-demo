import { eventEmitter, type ScopeEvent } from "./EventEmitter";

interface ScopeMetrics {
  scopeId: string;
  parentScopeId?: string;
  startMark: string;
  shortId: string;
  track: string;
  events: Array<{
    eventName: string;
    markName: string;
  }>;
}

interface DevtoolsDetail {
  color: string;
  trackGroup: string;
  track: string;
  properties?: Array<[string, string]>;
  tooltip?: string;
  label?: string;
}

export interface MeasurerOptions {
  /**
   * Prefix for performance marks
   * @default "query-lib"
   */
  prefix?: string;
  /**
   * Whether to use User Timing API (performance.mark/measure)
   * @default true
   */
  useUserTiming?: boolean;
  /**
   * Custom detail to add to all measures
   */
  defaultDetail?: Partial<DevtoolsDetail>;
}

export class Measurer {
  private scopes = new Map<string, ScopeMetrics>();
  private unsubscribe?: () => void;
  private options: Required<MeasurerOptions>;
  private readonly trackName = "Timeline";
  private readonly trackGroupName = "Query Library 🐐";

  constructor(options: MeasurerOptions = {}) {
    this.options = {
      prefix: options.prefix || "query-lib",
      useUserTiming: options.useUserTiming ?? true,
      defaultDetail: options.defaultDetail || {},
    };
    this.setupListeners();
  }

  public start() {
    this.setupListeners();
  }

  public stop() {
    if (this.unsubscribe !== undefined) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    this.scopes.clear();
  }

  private setupListeners() {
    this.unsubscribe = eventEmitter.onScopeStart(
      (scopeId, subscribeToScope, firstEvent) => {
        const shortScopeId = scopeId.substring(0, 8);
        const startMarkName = `${this.options.prefix}:${shortScopeId}:start`;

        // Create start mark
        if (this.options.useUserTiming) {
          performance.mark(startMarkName);
        }

        const metrics: ScopeMetrics = {
          scopeId,
          parentScopeId: firstEvent.parentScopeId,
          startMark: startMarkName,
          shortId: shortScopeId,
          track: this.trackName,
          events: [],
        };
        this.scopes.set(scopeId, metrics);

        // Handle first event
        const firstMarkName = this.createEventMark(firstEvent, metrics);
        metrics.events.push({
          eventName: firstEvent.eventName,
          markName: firstMarkName,
        });

        subscribeToScope((event) => {
          const markName = this.createEventMark(event, metrics);
          metrics.events.push({
            eventName: event.eventName,
            markName,
          });

          // Check if scope is complete
          if (this.isScopeComplete(event.eventName)) {
            this.createScopeMeasure(metrics, event);
            this.scopes.delete(scopeId);
          }
        });

        // Check if the first event already completed the scope
        if (this.isScopeComplete(firstEvent.eventName)) {
          this.createScopeMeasure(metrics, firstEvent);
          this.scopes.delete(scopeId);
        }
      }
    );
  }

  private isScopeComplete(eventName: string): boolean {
    return (
      eventName.endsWith(":success") ||
      eventName.endsWith(":error") ||
      eventName.endsWith(":pending")
    );
  }

  private createEventMark(event: ScopeEvent, metrics: ScopeMetrics): string {
    const label = this.getDisplayLabel(event.eventName, event.payload);
    const icon = this.getEventIcon(event.eventName);
    const markName = `${icon} ${label} (#${metrics.events.length + 1})`;

    if (this.options.useUserTiming) {
      performance.mark(markName, {
        detail: {
          devtools: this.buildDevtoolsDetail(event.eventName, event.payload),
        },
      });
    }

    return markName;
  }

  private createScopeMeasure(metrics: ScopeMetrics, finalEvent: ScopeEvent) {
    if (!this.options.useUserTiming || metrics.events.length === 0) {
      return;
    }

    const lastEvent = metrics.events[metrics.events.length - 1];
    const label = this.getDisplayLabel(
      finalEvent.eventName,
      finalEvent.payload
    );
    const icon = this.getEventIcon(finalEvent.eventName);
    const measureName = `${icon} ${label}`;

    try {
      // Check if marks exist before creating measure
      const marks = performance.getEntriesByType("mark");
      const startMarkExists = marks.some((m) => m.name === metrics.startMark);
      const endMarkExists = marks.some((m) => m.name === lastEvent.markName);

      if (!startMarkExists || !endMarkExists) {
        // Silently skip if marks don't exist
        this.cleanupMarks(metrics);
        return;
      }

      performance.measure(measureName, {
        start: metrics.startMark,
        end: lastEvent.markName,
        detail: {
          devtools: this.buildDevtoolsDetail(
            finalEvent.eventName,
            finalEvent.payload,
            this.getMeasureColor(finalEvent.eventName)
          ),
        },
      });

      // Clean up marks
      this.cleanupMarks(metrics);
    } catch (error) {
      console.warn("Failed to create performance measure:", error);
      // Still try to clean up
      this.cleanupMarks(metrics);
    }
  }

  private cleanupMarks(metrics: ScopeMetrics) {
    try {
      performance.clearMarks(metrics.startMark);
      metrics.events.forEach((event) => {
        performance.clearMarks(event.markName);
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  private getEventColor(eventName: string): string {
    if (eventName.endsWith(":error")) {
      return "error";
    }

    const base = this.getCategoryBaseColor(eventName);

    if (eventName.endsWith(":success")) {
      return this.applyTone(base, "dark");
    }

    if (eventName.endsWith(":pending")) {
      return this.applyTone(base, "light");
    }

    return base;
  }

  private getMeasureColor(eventName: string): string {
    if (eventName.endsWith(":error")) {
      return "error";
    }

    return this.applyTone(this.getCategoryBaseColor(eventName), "dark");
  }

  private getCategoryBaseColor(eventName: string): string {
    if (eventName.startsWith("mutation:")) {
      return "secondary";
    }

    if (eventName.startsWith("query:")) {
      return "primary";
    }

    return "tertiary";
  }

  private applyTone(base: string, tone: "light" | "dark"): string {
    if (base === "primary" || base === "secondary" || base === "tertiary") {
      return `${base}-${tone}`;
    }

    return base;
  }

  private getEventIcon(eventName: string): string {
    if (eventName.includes("garbage-collect")) return "🗑️";
    if (eventName.includes("stale")) return "⚠️";
    if (eventName.includes("invalidation")) return "🔄";
    if (eventName.endsWith(":start")) return "🚀";
    if (eventName.endsWith(":success")) return "✅";
    if (eventName.endsWith(":error")) return "❌";
    if (eventName.endsWith(":pending")) return "⏳";
    return "📌";
  }

  private getDisplayLabel(
    eventName: string,
    payload?: Record<string, unknown>
  ): string {
    const baseLabel = this.getBaseLabel(eventName);

    if (eventName.startsWith("query:")) {
      const keyLabel = this.formatQueryKey(payload);
      if (keyLabel != null) {
        return `${baseLabel} • ${keyLabel}`;
      }
    }

    return baseLabel;
  }

  private getBaseLabel(eventName: string): string {
    const statusTokens = new Set(["start", "success", "error", "pending"]);
    const parts = eventName.split(":");

    if (parts.length > 1 && statusTokens.has(parts[parts.length - 1])) {
      parts.pop();
    }

    if (parts.length === 0) {
      return eventName;
    }

    const [category, ...rest] = parts;
    const formattedCategory = this.capitalize(category);
    const formattedRest = rest.map((part) => this.capitalize(part)).join(" ");

    if (formattedRest.length === 0) {
      return formattedCategory;
    }

    return `${formattedCategory} ${formattedRest}`.trim();
  }

  private formatQueryKey(payload?: Record<string, unknown>): string | null {
    if (!payload || payload.key === undefined) {
      return null;
    }

    const keyValue = (payload as Record<string, unknown>).key;
    const stringified = this.stringifyValue(keyValue);

    if (stringified.length === 0) {
      return null;
    }

    return stringified;
  }

  private buildDevtoolsDetail(
    eventName: string,
    payload: Record<string, unknown> | undefined,
    fallbackColor?: string
  ): DevtoolsDetail {
    const baseColor = fallbackColor ?? this.getEventColor(eventName);
    const extractedProperties = this.extractProperties(payload);

    const detail: DevtoolsDetail = {
      color: this.options.defaultDetail.color ?? baseColor,
      trackGroup: this.options.defaultDetail.trackGroup ?? this.trackGroupName,
      track: this.options.defaultDetail.track ?? this.trackName,
    };

    if (
      this.options.defaultDetail.properties ||
      extractedProperties.length > 0
    ) {
      detail.properties = [
        ...(this.options.defaultDetail.properties ?? []),
        ...extractedProperties,
      ];
    }

    detail.tooltip =
      this.options.defaultDetail.tooltip ??
      this.formatTooltip(eventName, payload);

    return detail;
  }

  private extractProperties(
    payload: Record<string, unknown> | undefined
  ): Array<[string, string]> {
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const entries: Array<[string, string]> = [];

    for (const [key, value] of Object.entries(payload)) {
      if (key === "scopeId" || key === "parentScopeId") {
        continue;
      }

      entries.push([this.formatKey(key), this.stringifyValue(value)]);
    }

    return entries;
  }

  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private stringifyValue(value: unknown): string {
    if (value == null) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private formatTooltip(
    eventName: string,
    payload: Record<string, unknown> | undefined
  ): string {
    return this.getDisplayLabel(eventName, payload);
  }

  private capitalize(value: string): string {
    if (value.length === 0) {
      return value;
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  /**
   * Enable the measurer
   */
  enable() {
    if (!this.unsubscribe) {
      this.setupListeners();
    }
  }

  /**
   * Disable the measurer
   */
  disable() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    this.scopes.clear();
  }

  /**
   * Clear all performance marks and measures created by this measurer
   */
  clearAll() {
    if (this.options.useUserTiming) {
      // Clear all marks and measures with our prefix
      const entries = performance.getEntriesByType("mark");
      entries.forEach((entry) => {
        if (entry.name.startsWith(this.options.prefix)) {
          performance.clearMarks(entry.name);
        }
      });

      const measures = performance.getEntriesByType("measure");
      measures.forEach((measure) => {
        if (measure.name.startsWith(this.options.prefix)) {
          performance.clearMeasures(measure.name);
        }
      });
    }
  }

  /**
   * Get current active scopes (for debugging)
   */
  getActiveScopes() {
    return Array.from(this.scopes.values());
  }
}

// Create a singleton instance
export const measurer = new Measurer();
