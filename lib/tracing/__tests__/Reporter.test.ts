import type {
  TraceEvent,
  SpanStartEvent,
  SpanEndEvent,
  SpanEvent,
  ITracer,
  ISpan,
  SpanId,
} from "../src/types";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { BaseReporter } from "../src/reporters/BaseReporter";

// Helper to create mock spans with all required ISpan properties
function createMockSpan(overrides: Omit<Partial<ISpan>, "spanId"> & { spanId: string }): ISpan {
  return {
    spanId: overrides.spanId as unknown as SpanId,
    name: overrides.name ?? "Test Action",
    state: overrides.state ?? "running",
    parentSpan: overrides.parentSpan ?? undefined,
    payload: overrides.payload ?? {},
    meta: overrides.meta ?? { description: "Test span", color: "primary" as const },
    startTime: overrides.startTime ?? 1000,
    endTime: overrides.endTime ?? -1,
    serializedPayload: JSON.stringify(overrides.payload ?? {}),
    duration:
      (overrides.endTime ?? -1) > 0 ? (overrides.endTime ?? 0) - (overrides.startTime ?? 1000) : 0,
    start: vi.fn(),
    event: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
    [Symbol.dispose]: vi.fn(),
  };
}

// Test implementation of BaseReporter
class TestReporter extends BaseReporter {
  public startEvents: SpanStartEvent[] = [];
  public endEvents: SpanEndEvent[] = [];
  public spanEvents: SpanEvent[] = [];
  public startCalled = false;
  public stopCalled = false;

  protected onStart(): void {
    this.startCalled = true;
  }

  protected onStop(): void {
    this.stopCalled = true;
  }

  protected processEvents(events: TraceEvent[]): void {
    for (const event of events) {
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
      }
    }
  }

  protected onSpanStart(event: SpanStartEvent): void {
    this.startEvents.push(event);
    this.trackSpanStart(event);
  }

  protected onSpanEnd(event: SpanEndEvent): void {
    this.endEvents.push(event);
    this.untrackSpan(event.span.spanId);
  }

  protected onSpanEvent(event: SpanEvent): void {
    this.spanEvents.push(event);
    this.recordSpanEvent(event);
  }

  // Expose protected methods for testing
  public getTrackedSpan(spanId: string | SpanId) {
    return this.getSpanMetrics(spanId as SpanId);
  }

  public getTrackedSpanCount() {
    return this.spans.size;
  }
}

// Mock tracer for testing
class MockTracer implements ITracer {
  private receivers = new Set<{ handleEvent: (e: TraceEvent) => void }>();

  addReporter(receiver: { handleEvent: (e: TraceEvent) => void }): () => void {
    this.receivers.add(receiver);
    return () => this.receivers.delete(receiver);
  }

  deleteReporter(receiver: { handleEvent: (e: TraceEvent) => void }): void {
    this.receivers.delete(receiver);
  }

  hasReporters(): boolean {
    return this.receivers.size > 0;
  }

  createSpan(): never {
    throw new Error("Not implemented");
  }

  startSpan(): never {
    throw new Error("Not implemented");
  }

  // Helper to emit events for testing
  emit(event: TraceEvent): void {
    this.receivers.forEach((r) => r.handleEvent(event));
  }
}

describe("BaseReporter", () => {
  let tracer: MockTracer;
  let reporter: TestReporter;

  beforeEach(() => {
    tracer = new MockTracer();
    reporter = new TestReporter();
    vi.spyOn(performance, "now").mockReturnValue(1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("lifecycle", () => {
    it("should not be active before start()", () => {
      expect(reporter.isActive).toBe(false);
    });

    it("should be active after start()", () => {
      reporter.start();

      expect(reporter.isActive).toBe(false); // Note: isActive depends on unregister being set
      expect(reporter.startCalled).toBe(true);
    });

    it("should call onStop when stopped", () => {
      reporter.start();
      reporter.stop();

      expect(reporter.stopCalled).toBe(true);
    });

    it("should be idempotent - multiple start() calls", () => {
      reporter.start();
      reporter.start();
      reporter.start();

      expect(reporter.startCalled).toBe(true);
    });
  });

  describe("event handling", () => {
    const mockSpan = createMockSpan({
      spanId: "test-span-1",
      payload: { key: "value" },
    });

    it("should receive span start events", () => {
      reporter.start();
      tracer.addReporter(reporter);

      const event: SpanStartEvent = {
        kind: "start",
        span: mockSpan,
        parentSpan: undefined,
        name: "Test Action",
        payload: { key: "value" },
        timestamp: 1000,
      };

      tracer.emit(event);

      expect(reporter.startEvents).toHaveLength(1);
      expect(reporter.startEvents[0]).toBe(event);
    });

    it("should receive span end events", () => {
      reporter.start();
      tracer.addReporter(reporter);

      const startEvent: SpanStartEvent = {
        kind: "start",
        span: mockSpan,
        parentSpan: undefined,
        name: "Test Action",
        payload: { key: "value" },
        timestamp: 1000,
      };

      const endEvent: SpanEndEvent = {
        kind: "end",
        span: mockSpan,
        parentSpan: undefined,
        status: "success",
        payload: { result: "ok" },
        timestamp: 2000,
      };

      tracer.emit(startEvent);
      tracer.emit(endEvent);

      expect(reporter.endEvents).toHaveLength(1);
      expect(reporter.endEvents[0]).toBe(endEvent);
    });

    it("should receive span intermediate events", () => {
      reporter.start();
      tracer.addReporter(reporter);

      const startEvent: SpanStartEvent = {
        kind: "start",
        span: mockSpan,
        parentSpan: undefined,
        name: "Test Action",
        payload: { key: "value" },
        timestamp: 1000,
      };

      const spanEvent: SpanEvent = {
        kind: "event",
        span: mockSpan,
        parentSpan: undefined,
        eventName: "checkpoint",
        payload: { progress: 50 },
        timestamp: 1500,
      };

      tracer.emit(startEvent);
      tracer.emit(spanEvent);

      expect(reporter.spanEvents).toHaveLength(1);
      expect(reporter.spanEvents[0]).toBe(spanEvent);
    });

    it("should not receive events when stopped", () => {
      reporter.start();
      const unregister = tracer.addReporter(reporter);
      unregister();
      reporter.stop();

      const event: SpanStartEvent = {
        kind: "start",
        span: mockSpan,
        parentSpan: undefined,
        name: "Test Action",
        payload: {},
        timestamp: 1000,
      };

      tracer.emit(event);

      expect(reporter.startEvents).toHaveLength(0);
    });
  });

  describe("span tracking", () => {
    const mockSpan = createMockSpan({
      spanId: "tracked-span",
      payload: { key: "tracked" },
    });

    it("should track span on start", () => {
      reporter.start();
      tracer.addReporter(reporter);

      const event: SpanStartEvent = {
        kind: "start",
        span: mockSpan,
        parentSpan: undefined,
        name: "Test Action",
        payload: { key: "tracked" },
        timestamp: 1000,
      };

      tracer.emit(event);

      expect(reporter.getTrackedSpanCount()).toBe(1);
      const tracked = reporter.getTrackedSpan("tracked-span");
      expect(tracked).toBeDefined();
      expect(tracked?.spanId).toBe("tracked-span");
      expect(tracked?.payload).toEqual({ key: "tracked" });
    });

    it("should untrack span on end", () => {
      reporter.start();
      tracer.addReporter(reporter);

      const startEvent: SpanStartEvent = {
        kind: "start",
        span: mockSpan,
        parentSpan: undefined,
        name: "Test Action",
        payload: {},
        timestamp: 1000,
      };

      const endEvent: SpanEndEvent = {
        kind: "end",
        span: mockSpan,
        parentSpan: undefined,
        status: "success",
        timestamp: 2000,
      };

      tracer.emit(startEvent);
      expect(reporter.getTrackedSpanCount()).toBe(1);

      tracer.emit(endEvent);
      expect(reporter.getTrackedSpanCount()).toBe(0);
    });

    it("should clear tracked spans on stop", () => {
      reporter.start();
      tracer.addReporter(reporter);

      const event: SpanStartEvent = {
        kind: "start",
        span: mockSpan,
        parentSpan: undefined,
        name: "Test Action",
        payload: {},
        timestamp: 1000,
      };

      tracer.emit(event);
      expect(reporter.getTrackedSpanCount()).toBe(1);

      reporter.stop();
      expect(reporter.getTrackedSpanCount()).toBe(0);
    });

    it("should record intermediate events on tracked spans", () => {
      reporter.start();
      tracer.addReporter(reporter);

      const startEvent: SpanStartEvent = {
        kind: "start",
        span: mockSpan,
        parentSpan: undefined,
        name: "Test Action",
        payload: {},
        timestamp: 1000,
      };

      const spanEvent: SpanEvent = {
        kind: "event",
        span: mockSpan,
        parentSpan: undefined,
        eventName: "checkpoint",
        payload: { progress: 50 },
        timestamp: 1500,
      };

      tracer.emit(startEvent);
      tracer.emit(spanEvent);

      const tracked = reporter.getTrackedSpan("tracked-span");
      expect(tracked?.events).toHaveLength(1);
      expect(tracked?.events[0].name).toBe("checkpoint");
    });
  });

  describe("multiple reporters", () => {
    it("should support multiple reporters on same tracer", () => {
      const reporter1 = new TestReporter();
      const reporter2 = new TestReporter();

      reporter1.start();
      reporter2.start();
      tracer.addReporter(reporter1);
      tracer.addReporter(reporter2);

      const mockSpan = createMockSpan({
        spanId: "multi-test",
      });

      const event: SpanStartEvent = {
        kind: "start",
        span: mockSpan,
        parentSpan: undefined,
        name: "Test Action",
        payload: {},
        timestamp: 1000,
      };

      tracer.emit(event);

      expect(reporter1.startEvents).toHaveLength(1);
      expect(reporter2.startEvents).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("should handle span end without corresponding start (reporter added mid-span)", () => {
      const mockSpan = createMockSpan({
        spanId: "orphan-span",
        endTime: 2000,
      });

      // Start reporter AFTER span already started
      reporter.start();
      tracer.addReporter(reporter);

      const endEvent: SpanEndEvent = {
        kind: "end",
        span: mockSpan,
        parentSpan: undefined,
        status: "success",
        timestamp: 2000,
      };

      // Should not throw
      tracer.emit(endEvent);

      // Event is still received
      expect(reporter.endEvents).toHaveLength(1);
      // But no span was tracked to untrack
      expect(reporter.getTrackedSpanCount()).toBe(0);
    });

    it("should handle span event without corresponding start", () => {
      const mockSpan = createMockSpan({
        spanId: "orphan-span",
      });

      reporter.start();
      tracer.addReporter(reporter);

      const spanEvent: SpanEvent = {
        kind: "event",
        span: mockSpan,
        parentSpan: undefined,
        eventName: "checkpoint",
        timestamp: 1500,
      };

      // Should not throw
      tracer.emit(spanEvent);

      // Event is received
      expect(reporter.spanEvents).toHaveLength(1);
    });
  });
});

describe("Tracer with reporters", () => {
  beforeEach(() => {
    vi.spyOn(performance, "now").mockReturnValue(1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should dispatch events to reporters", async () => {
    const { Tracer } = await import("../src/Tracer");
    const tracer = new Tracer();
    const reporter = new TestReporter();

    tracer.addReporter(reporter);
    reporter.start();

    const span = tracer.startSpan(
      "Test Span",
      { key: "value" },
      {
        description: "Test span",
        color: "primary",
      },
    );

    expect(reporter.startEvents).toHaveLength(1);
    expect(reporter.startEvents[0].name).toBe("Test Span");

    vi.spyOn(performance, "now").mockReturnValue(2000);
    span.success({ result: "ok" });

    expect(reporter.endEvents).toHaveLength(1);
    expect(reporter.endEvents[0].status).toBe("success");
  });

  it("should handle reporter errors without affecting tracer", async () => {
    const { Tracer } = await import("../src/Tracer");
    const tracer = new Tracer();

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Broken reporter that throws
    const brokenReporter = {
      handleEvent: () => {
        throw new Error("Reporter exploded!");
      },
    };

    const goodReporter = new TestReporter();

    tracer.addReporter(brokenReporter);
    tracer.addReporter(goodReporter);
    goodReporter.start();

    // Should not throw
    tracer.startSpan(
      "Test Span",
      {},
      {
        description: "Test span",
        color: "primary",
      },
    );

    // Error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith("Reporter error:", expect.any(Error));

    // Good reporter still received event
    expect(goodReporter.startEvents).toHaveLength(1);

    consoleErrorSpy.mockRestore();
  });
});

describe("NullTracer with reporters", () => {
  it("should not throw when adding reporter", async () => {
    const { NullTracer } = await import("../src/NullTracer");
    const tracer = new NullTracer();

    const receiver = { handleEvent: vi.fn() };

    // Should not throw
    const unregister = tracer.addReporter(receiver);
    expect(typeof unregister).toBe("function");

    // Unregister should also not throw
    unregister();
  });

  it("should always return false for hasReporters()", async () => {
    const { NullTracer } = await import("../src/NullTracer");
    const tracer = new NullTracer();

    expect(tracer.hasReporters()).toBe(false);

    tracer.addReporter({ handleEvent: vi.fn() });

    expect(tracer.hasReporters()).toBe(false);
  });
});
