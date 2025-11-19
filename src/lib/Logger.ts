import { eventEmitter, type ScopeEvent } from "./EventEmitter";

interface ScopeTrace {
  scopeId: string;
  events: Array<{
    eventName: string;
    timestamp: number;
    payload: any;
  }>;
  startTime: number;
}

export class Logger {
  private traces = new Map<string, ScopeTrace>();
  private unsubscribe?: () => void;

  public start() {
    this.setupListeners();

    return () => {
      this.stop();
    };
  }

  public stop() {
    if (this.unsubscribe !== undefined) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    this.traces.clear();
  }

  private setupListeners() {
    this.unsubscribe = eventEmitter.onScopeStart(
      (scopeId, subscribeToScope, firstEvent) => {
        const trace: ScopeTrace = {
          scopeId,
          events: [],
          startTime: performance.now(),
        };
        this.traces.set(scopeId, trace);

        // Handle the first event
        trace.events.push({
          eventName: firstEvent.eventName,
          timestamp: performance.now() - trace.startTime,
          payload: firstEvent.payload,
        });
        this.logEvent(firstEvent, trace);

        // Subscribe to subsequent events
        subscribeToScope((event) => {
          trace.events.push({
            eventName: event.eventName,
            timestamp: performance.now() - trace.startTime,
            payload: event.payload,
          });

          // Log the event
          this.logEvent(event, trace);

          // Check if scope is complete
          if (this.isScopeComplete(event.eventName)) {
            this.logScopeSummary(trace);
            this.traces.delete(scopeId);
          }
        });

        // Check if the first event already completed the scope
        if (this.isScopeComplete(firstEvent.eventName)) {
          this.logScopeSummary(trace);
          this.traces.delete(scopeId);
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

  private getEventCategory(eventName: string): string {
    if (eventName.startsWith("query:")) return "Query";
    if (eventName.startsWith("mutation:")) return "Mutation";
    if (eventName.startsWith("function:")) return "Function";
    if (eventName.startsWith("client:")) return "Client";
    return "Unknown";
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

  private getEventColor(eventName: string): string {
    if (eventName.includes("garbage-collect")) return "#f87171"; // red
    if (eventName.includes("stale")) return "#f59e0b"; // amber
    if (eventName.includes("invalidation")) return "#06b6d4"; // cyan
    if (eventName.endsWith(":start")) return "#3b82f6"; // blue
    if (eventName.endsWith(":success")) return "#10b981"; // green
    if (eventName.endsWith(":error")) return "#ef4444"; // red
    if (eventName.endsWith(":pending")) return "#f59e0b"; // amber
    return "#6b7280"; // gray
  }

  private logEvent(event: ScopeEvent, trace: ScopeTrace) {
    const isFirstEvent = trace.events.length === 1;
    const icon = this.getEventIcon(event.eventName);
    const category = this.getEventCategory(event.eventName);
    const color = this.getEventColor(event.eventName);

    if (isFirstEvent) {
      console.group(
        `%c${icon} ${category}`,
        `color: ${color}; font-weight: bold;`
      );
    }

    const timestamp = `+${trace.events[
      trace.events.length - 1
    ].timestamp.toFixed(2)}ms`;
    console.log(
      `%c${icon} ${event.eventName} %c${timestamp}`,
      `color: ${color}; font-weight: bold;`,
      `color: #9ca3af; font-size: 0.9em;`
    );

    // Log payload details based on event type
    this.logPayloadDetails(event.eventName, event.payload);
  }

  private logPayloadDetails(eventName: string, payload: any) {
    if (
      eventName.includes("query:fetch") ||
      eventName.includes("query:prefetch")
    ) {
      console.log("  Key:", payload.key);
      if (payload.duration !== undefined) {
        console.log("  Duration:", `${payload.duration.toFixed(2)}ms`);
      }
      if (payload.error) {
        console.error("  Error:", payload.error);
      }
    } else if (eventName.includes("mutation")) {
      if (eventName.includes("invalidation")) {
        console.log("  Queries to invalidate:", payload.queries);
        if (payload.duration !== undefined) {
          console.log("  Duration:", `${payload.duration.toFixed(2)}ms`);
        }
      } else {
        console.log("  Variables:", payload.variables);
        if (payload.duration !== undefined) {
          console.log("  Duration:", `${payload.duration.toFixed(2)}ms`);
        }
        if (payload.data !== undefined) {
          console.log("  Data:", payload.data);
        }
        if (payload.error) {
          console.error("  Error:", payload.error);
        }
      }
    } else if (eventName.includes("function")) {
      console.log("  Function:", payload.name);
      console.log("  Arguments:", payload.args);
      if (payload.duration !== undefined) {
        console.log("  Duration:", `${payload.duration.toFixed(2)}ms`);
      }
      if (payload.result !== undefined) {
        console.log("  Result:", payload.result);
      }
      if (payload.error) {
        console.error("  Error:", payload.error);
      }
    } else if (eventName.includes("garbage-collect")) {
      console.log("  Key:", payload.key);
    }
  }

  private logScopeSummary(trace: ScopeTrace) {
    const lastEvent = trace.events[trace.events.length - 1];
    const totalDuration = lastEvent.timestamp;

    console.log(
      `%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      "color: #6b7280;"
    );
    console.log(`%cScope Summary`, "color: #6b7280; font-weight: bold;");
    console.log(`  Total Events: ${trace.events.length}`);
    console.log(`  Total Duration: ${totalDuration.toFixed(2)}ms`);

    // Create a table of events
    const tableData = trace.events.map((event) => ({
      Event: event.eventName,
      Timestamp: `${event.timestamp.toFixed(2)}ms`,
      Details: this.getEventDetails(event.eventName, event.payload),
    }));

    console.table(tableData);
    console.groupEnd();
  }

  private getEventDetails(eventName: string, payload: any): string {
    if (eventName.includes("query")) {
      return `Key: ${payload.key}`;
    } else if (eventName.includes("mutation")) {
      if (eventName.includes("invalidation")) {
        return `Queries: ${payload.queries?.length || 0}`;
      }
      return `Variables: ${JSON.stringify(payload.variables)}`;
    } else if (eventName.includes("function")) {
      return `Function: ${payload.name}`;
    }
    return "-";
  }

  /**
   * Enable the logger
   */
  enable() {
    if (!this.unsubscribe) {
      this.setupListeners();
    }
  }

  /**
   * Disable the logger
   */
  disable() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    this.traces.clear();
  }

  /**
   * Get current active traces (for debugging)
   */
  getActiveTraces() {
    return Array.from(this.traces.values());
  }
}

// Create a singleton instance
export const logger = new Logger();
