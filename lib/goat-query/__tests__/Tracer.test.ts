import type { TraceEvent, IEventReceiver } from "../../tracing/types";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We'll test the internal implementation directly
// First, let's create a test-only tracer to avoid import.meta.env.DEV issues

const testMeta = { description: "Test span", color: "primary" as const };

describe("Span", () => {
  // Mock emit function
  let emitMock: ReturnType<typeof vi.fn<(event: TraceEvent) => void>>;

  beforeEach(() => {
    emitMock = vi.fn<(event: TraceEvent) => void>();
    vi.spyOn(performance, "now").mockReturnValue(1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("lifecycle", () => {
    it("should be created in inactive state", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const span = new Span({
        name: "Test Span",
        payload: { key: "value" },
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      expect(span.state).toBe("inactive");
      expect(emitMock).not.toHaveBeenCalled();
    });

    it("should transition to running state when started", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const span = new Span({
        name: "Test Span",
        payload: { key: "value" },
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      span.start();

      expect(span.state).toBe("running");
      expect(span.startTime).toBe(1000);
      expect(emitMock).toHaveBeenCalledTimes(1);
      expect(emitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "start",
          name: "Test Span",
          payload: { key: "value" },
        }),
      );
    });

    it("should transition to ended state on success", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const span = new Span({
        name: "Test Span",
        payload: {},
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      span.start();
      vi.spyOn(performance, "now").mockReturnValue(2000);
      span.success({ result: "ok" });

      expect(span.state).toBe("success");
      expect(span.endTime).toBe(2000);
      expect(emitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "end",
          status: "success",
          payload: { result: "ok" },
        }),
      );
    });

    it("should transition to ended state on error", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const span = new Span({
        name: "Test Span",
        payload: {},
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      const testError = new Error("test error");
      span.start();
      span.error(testError, { context: "test" });

      expect(span.state).toBe("error");
      expect(emitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "end",
          status: "error",
          error: testError,
          payload: { context: "test" },
        }),
      );
    });

    it("should ignore start() if already running", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const span = new Span({
        name: "Test Span",
        payload: {},
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      span.start();
      span.start(); // second call should be ignored

      expect(emitMock).toHaveBeenCalledTimes(1);
    });

    it("should ignore start() if already ended", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const span = new Span({
        name: "Test Span",
        payload: {},
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      span.start();
      span.success();
      emitMock.mockClear();

      span.start(); // should be ignored

      expect(emitMock).not.toHaveBeenCalled();
    });

    it("should ignore success()/error() if not running", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const span = new Span({
        name: "Test Span",
        payload: {},
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      span.success(); // should be ignored (inactive)
      span.error(new Error("test")); // should be ignored (inactive)

      expect(emitMock).not.toHaveBeenCalled();
    });

    it("should ignore success()/error() if already ended", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const span = new Span({
        name: "Test Span",
        payload: {},
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      span.start();
      span.success();
      emitMock.mockClear();

      span.success(); // should be ignored
      span.error(new Error("test")); // should be ignored

      expect(emitMock).not.toHaveBeenCalled();
    });
  });

  describe("event()", () => {
    it("should emit intermediate events while running", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const span = new Span({
        name: "Test Span",
        payload: {},
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      span.start();
      span.event("checkpoint", { progress: 50 });

      expect(emitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "event",
          eventName: "checkpoint",
          payload: { progress: 50 },
          span,
        }),
      );
    });

    it("should ignore events if not running", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const span = new Span({
        name: "Test Span",
        payload: {},
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      span.event("test", {}); // inactive, should be ignored

      expect(emitMock).not.toHaveBeenCalled();
    });

    it("should ignore events if ended", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const span = new Span({
        name: "Test Span",
        payload: {},
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      span.start();
      span.success();
      emitMock.mockClear();

      span.event("test", {}); // ended, should be ignored

      expect(emitMock).not.toHaveBeenCalled();
    });
  });

  describe("child spans", () => {
    it("should create a child span with parent reference", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const parentSpan = new Span({
        name: "Parent Span",
        payload: {},
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      parentSpan.start();

      const childSpan = parentSpan.child({
        name: "Child Span",
        payload: { childKey: "value" },
        meta: testMeta,
      });

      expect(childSpan.parentSpan).toBe(parentSpan);
      expect(childSpan.state).toBe("running"); // child is auto-started
      expect(childSpan.name).toBe("Child Span");
      expect(childSpan.payload).toEqual({ childKey: "value" });
    });

    it("should emit parent info in child events", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const parentSpan = new Span({
        name: "Parent Span",
        payload: {},
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      parentSpan.start();

      parentSpan.child({
        name: "Child Span",
        payload: {},
        meta: testMeta,
      });

      expect(emitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "start",
          name: "Child Span",
          parentSpan: parentSpan,
        }),
      );
    });
  });

  describe("properties", () => {
    it("should have unique spanId", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const span1 = new Span({
        name: "Test Span",
        payload: {},
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      const span2 = new Span({
        name: "Test Span",
        payload: {},
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      expect(span1.spanId).toBeTruthy();
      expect(span2.spanId).toBeTruthy();
      expect(span1.spanId).not.toBe(span2.spanId);
    });

    it("should expose correct properties", async () => {
      const { Span } = await import("../../tracing/Tracer");

      const span = new Span({
        name: "Test Name",
        payload: { testKey: "testValue" },
        parentSpan: undefined,
        emit: emitMock,
        meta: testMeta,
      });

      expect(span.name).toBe("Test Name");
      expect(span.payload).toEqual({ testKey: "testValue" });
      expect(span.parentSpan).toBeUndefined();
      expect(span.startTime).toBe(0);
      expect(span.endTime).toBe(0);
    });
  });
});

describe("Tracer", () => {
  beforeEach(() => {
    vi.spyOn(performance, "now").mockReturnValue(1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("addReporter()", () => {
    it("should add reporter and receive events", async () => {
      const { Tracer } = await import("../../tracing/Tracer");
      const tracer = new Tracer();

      const reporter: IEventReceiver = { handleEvent: vi.fn() };
      tracer.addReporter(reporter);

      const span = tracer.createSpan("Test Span", {}, testMeta);
      span.start();

      // oxlint-disable-next-line typescript/unbound-method
      expect(reporter.handleEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "start",
          name: "Test Span",
        }),
      );
    });

    it("should return unregister function", async () => {
      const { Tracer } = await import("../../tracing/Tracer");
      const tracer = new Tracer();

      const reporter: IEventReceiver = { handleEvent: vi.fn() };
      const unregister = tracer.addReporter(reporter);

      unregister();

      const span = tracer.createSpan("Test Span", {}, testMeta);
      span.start();

      // oxlint-disable-next-line typescript/unbound-method
      expect(reporter.handleEvent).not.toHaveBeenCalled();
    });

    it("should support multiple reporters", async () => {
      const { Tracer } = await import("../../tracing/Tracer");
      const tracer = new Tracer();

      const reporter1: IEventReceiver = { handleEvent: vi.fn() };
      const reporter2: IEventReceiver = { handleEvent: vi.fn() };

      tracer.addReporter(reporter1);
      tracer.addReporter(reporter2);

      const span = tracer.createSpan("Test Span", {}, testMeta);
      span.start();

      // oxlint-disable-next-line typescript/unbound-method
      expect(reporter1.handleEvent).toHaveBeenCalled();
      // oxlint-disable-next-line typescript/unbound-method
      expect(reporter2.handleEvent).toHaveBeenCalled();
    });
  });

  describe("hasReporters()", () => {
    it("should return false when no reporters", async () => {
      const { Tracer } = await import("../../tracing/Tracer");
      const tracer = new Tracer();

      expect(tracer.hasReporters()).toBe(false);
    });

    it("should return true when has reporters", async () => {
      const { Tracer } = await import("../../tracing/Tracer");
      const tracer = new Tracer();

      tracer.addReporter({ handleEvent: () => {} });

      expect(tracer.hasReporters()).toBe(true);
    });

    it("should return false after unregister", async () => {
      const { Tracer } = await import("../../tracing/Tracer");
      const tracer = new Tracer();

      const unregister = tracer.addReporter({ handleEvent: () => {} });
      unregister();

      expect(tracer.hasReporters()).toBe(false);
    });
  });

  describe("createSpan()", () => {
    it("should create span without starting it", async () => {
      const { Tracer } = await import("../../tracing/Tracer");
      const tracer = new Tracer();

      const reporter: IEventReceiver = { handleEvent: vi.fn() };
      tracer.addReporter(reporter);

      const span = tracer.createSpan("Test Span", { key: "value" }, testMeta);

      expect(span.state).toBe("inactive");
      // oxlint-disable-next-line typescript/unbound-method
      expect(reporter.handleEvent).not.toHaveBeenCalled();
    });

    it("should create span with correct name and payload", async () => {
      const { Tracer } = await import("../../tracing/Tracer");
      const tracer = new Tracer();

      const span = tracer.createSpan("Test Span", { key: "value" }, testMeta);

      expect(span.name).toBe("Test Span");
      expect(span.payload).toEqual({ key: "value" });
    });
  });

  describe("startSpan()", () => {
    it("should create and start span", async () => {
      const { Tracer } = await import("../../tracing/Tracer");
      const tracer = new Tracer();

      const reporter: IEventReceiver = { handleEvent: vi.fn() };
      tracer.addReporter(reporter);

      const span = tracer.startSpan("Test Span", { key: "value" }, testMeta);

      expect(span.state).toBe("running");
      // oxlint-disable-next-line typescript/unbound-method
      expect(reporter.handleEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "start",
          name: "Test Span",
          payload: { key: "value" },
        }),
      );
    });
  });

  describe("error handling in reporters", () => {
    it("should catch and log reporter errors", async () => {
      const { Tracer } = await import("../../tracing/Tracer");
      const tracer = new Tracer();

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const errorReporter: IEventReceiver = {
        handleEvent: () => {
          throw new Error("reporter error");
        },
      };
      const goodReporter: IEventReceiver = { handleEvent: vi.fn() };

      tracer.addReporter(errorReporter);
      tracer.addReporter(goodReporter);

      const span = tracer.createSpan("Test Span", {}, testMeta);
      span.start();

      expect(consoleErrorSpy).toHaveBeenCalledWith("Reporter error:", expect.any(Error));
      // oxlint-disable-next-line typescript/unbound-method
      expect(goodReporter.handleEvent).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});

describe("NullTracer", () => {
  it("should return no-op span", async () => {
    const { NullTracer } = await import("../../tracing/NullTracer");
    const tracer = new NullTracer();

    const span = tracer.createSpan("Test Span", {});

    // All methods should be no-ops
    span.start();
    span.event("test", {});
    span.success();

    // Should not throw
    expect(span.name).toBe("");
  });

  it("should always return false for hasReporters()", async () => {
    const { NullTracer } = await import("../../tracing/NullTracer");
    const tracer = new NullTracer();

    expect(tracer.hasReporters()).toBe(false);

    tracer.addReporter({ handleEvent: () => {} }); // even after addReporter attempt

    expect(tracer.hasReporters()).toBe(false);
  });

  it("should return same no-op span for child()", async () => {
    const { NullTracer } = await import("../../tracing/NullTracer");
    const tracer = new NullTracer();

    const span = tracer.createSpan("Test Span", {});
    const childSpan = span.child({ name: "Child Span", payload: {}, meta: testMeta });

    expect(childSpan.name).toBe("");
  });
});
