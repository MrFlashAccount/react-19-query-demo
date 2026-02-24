import { addTraceReporter, type TraceReporterEvent } from "../../src/tracing";

export interface RecordedTraceEvent {
  name: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}

export interface RecordedSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  payload: Record<string, unknown>;
  startTime: number;
  endTime?: number;
  status?: "success" | "error";
  duration?: number;
  endPayload?: Record<string, unknown>;
  error?: unknown;
  events: RecordedTraceEvent[];
}

export class TraceRecorder {
  private readonly spansById = new Map<string, RecordedSpan>();
  private unsubscribe?: () => void;

  start(): void {
    if (this.unsubscribe != null) {
      return;
    }
    this.unsubscribe = addTraceReporter(this);
  }

  stop(): void {
    if (this.unsubscribe != null) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  reset(): void {
    this.spansById.clear();
  }

  handleEvent(event: TraceReporterEvent): void {
    const spanId = String(event.span.spanId);
    if (event.kind === "start") {
      this.spansById.set(spanId, {
        spanId,
        parentSpanId: event.parentSpan == null ? undefined : String(event.parentSpan.spanId),
        name: event.name,
        payload: event.payload,
        startTime: event.timestamp,
        events: [],
      });
      return;
    }

    const recorded = this.spansById.get(spanId);
    if (recorded == null) {
      return;
    }

    if (event.kind === "event") {
      recorded.events.push({
        name: event.eventName,
        timestamp: event.timestamp,
        payload: event.payload,
      });
      return;
    }

    recorded.status = event.status;
    recorded.endTime = event.timestamp;
    recorded.duration = Math.max(0, event.span.duration);
    recorded.endPayload = event.payload;
    if (event.status === "error") {
      recorded.error = event.error;
    }
  }

  getSpans(): RecordedSpan[] {
    return Array.from(this.spansById.values()).sort((left, right) => left.startTime - right.startTime);
  }

  getSpansByName(name: string): RecordedSpan[] {
    return this.getSpans().filter((span) => this.matchesSpanName(span.name, name));
  }

  getSingleSpanByName(name: string): RecordedSpan {
    const spans = this.getSpansByName(name);
    if (spans.length !== 1) {
      throw new Error(`Expected exactly one span named "${name}", found ${spans.length}.`);
    }
    return spans[0];
  }

  isDescendant(childSpanId: string, ancestorSpanId: string): boolean {
    let current: RecordedSpan | undefined = this.spansById.get(childSpanId);
    while (current != null && current.parentSpanId != null) {
      if (current.parentSpanId === ancestorSpanId) {
        return true;
      }
      current = this.spansById.get(current.parentSpanId);
    }
    return false;
  }

  private matchesSpanName(actual: string, expected: string): boolean {
    if (actual === expected) {
      return true;
    }

    const prefixesByTraceKey: Record<string, string[]> = {
      "rsc.action.call": ["Action Send"],
      "rsc.client.callServer": ["Action Send"],
      "rsc.action.encodeArgs": ["Action Encode Args"],
      "rsc.action.consumeResponse": ["Action Decode Response"],
      "rsc.client.fetchRSC": ["Render Send Fetch"],
      "rsc.react.invalidate": ["Invalidate"],
      "rsc.react.rerender.fetch": ["Rerender Send Fetch"],
      "rsc.react.applyBatch": ["Rerender Decode Updates"],
      "rsc.react.batch.target.decodeRows": ["Rerender Decode Target Rows"],
      "rsc.component.render": ["Render #", "Render:"],
      "rsc.component.encode": ["Encode #", "Encode:"],
      "rsc.component.decode": ["Decode #", "Decode:"],
    };

    const prefixes = prefixesByTraceKey[expected];
    if (prefixes == null) {
      return false;
    }
    return prefixes.some((prefix) => actual.startsWith(prefix));
  }
}
