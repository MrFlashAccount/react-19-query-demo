import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flightDoneRow, flightModelRow } from "../src/flight-runtime/wire";
import { finishTraceSpanSuccess, startTraceSpan } from "../src/tracing";
import { TraceRecorder } from "./utils/trace-recorder";

const mocks = vi.hoisted(() => ({
  fetchRSC: vi.fn(async () => null),
  createCallServer: vi.fn(() => vi.fn(async () => null)),
  bootstrapWorkerRuntime: vi.fn(async () => ({
    worker: {} as Worker,
    transport: { sendAction: vi.fn() },
    dispose: vi.fn(),
  })),
  stateSetter: vi.fn(),
  startTransition: vi.fn((callback: () => void) => {
    callback();
  }),
  activeLoader: null as object | null,
  refsByLoader: new WeakMap<object, { current: unknown }>(),
  cleanupByLoader: new WeakMap<object, () => void>(),
  effectRegisteredByLoader: new WeakSet<object>(),
  seenLoaders: new Set<object>(),
}));

vi.mock("../src/client", () => ({
  fetchRSC: mocks.fetchRSC,
  createCallServer: mocks.createCallServer,
  bootstrapWorkerRuntime: mocks.bootstrapWorkerRuntime,
}));

vi.mock("react", () => ({
  startTransition: mocks.startTransition,
  use: (value: unknown) => value,
  useEffect: (effect: () => void | (() => void)) => {
    const loader = mocks.activeLoader;
    if (loader == null) {
      throw new Error("useEffect called without an active loader context");
    }
    if (mocks.effectRegisteredByLoader.has(loader)) {
      return;
    }
    mocks.effectRegisteredByLoader.add(loader);
    const cleanup = effect();
    if (typeof cleanup === "function") {
      mocks.cleanupByLoader.set(loader, cleanup);
    }
  },
  useState: () => [{}, mocks.stateSetter],
  useRef: (initialValue: unknown) => {
    const loader = mocks.activeLoader;
    if (loader == null) {
      throw new Error("useRef called without an active loader context");
    }

    const existing = mocks.refsByLoader.get(loader);
    if (existing != null) {
      return existing;
    }

    const ref = { current: initialValue };
    mocks.refsByLoader.set(loader, ref);
    return ref;
  },
  useTransition: () => [false, mocks.startTransition],
}));

async function renderLoader<TProps>(
  loader: (props: TProps) => Promise<unknown>,
  props: TProps,
): Promise<unknown> {
  const loaderKey = loader as unknown as object;
  mocks.activeLoader = loaderKey;
  mocks.seenLoaders.add(loaderKey);
  try {
    return await loader(props);
  } finally {
    mocks.activeLoader = null;
  }
}

function cleanupLoader(loader: object): void {
  const cleanup = mocks.cleanupByLoader.get(loader);
  if (cleanup != null) {
    cleanup();
    mocks.cleanupByLoader.delete(loader);
  }
  mocks.effectRegisteredByLoader.delete(loader);
  mocks.refsByLoader.delete(loader);
}

describe("react rsc invalidation", () => {
  const traceRecorder = new TraceRecorder();

  beforeEach(() => {
    mocks.fetchRSC.mockReset();
    mocks.fetchRSC.mockResolvedValue(null);
    mocks.bootstrapWorkerRuntime.mockReset();
    mocks.bootstrapWorkerRuntime.mockResolvedValue({
      worker: {} as Worker,
      transport: { sendAction: vi.fn() },
      dispose: vi.fn(),
    });
    mocks.createCallServer.mockReset();
    mocks.createCallServer.mockImplementation(() => vi.fn(async () => null));
    mocks.stateSetter.mockReset();
    mocks.startTransition.mockClear();
    mocks.activeLoader = null;
    mocks.refsByLoader = new WeakMap<object, { current: unknown }>();
    mocks.cleanupByLoader = new WeakMap<object, () => void>();
    mocks.effectRegisteredByLoader = new WeakSet<object>();
    mocks.seenLoaders.clear();
    vi.resetModules();
    traceRecorder.reset();
    traceRecorder.start();
  });

  afterEach(() => {
    for (const loader of mocks.seenLoaders) {
      cleanupLoader(loader);
    }
    mocks.seenLoaders.clear();
    traceRecorder.stop();
  });

  it("supports repeated invalidateRSC refresh cycles", async () => {
    const { invalidateRSC, rsc } = await import("../src/react");
    const WorkerViewRef = {
      $$typeof: Symbol.for("rsc.worker.reference"),
      $$id: "worker-components.tsx#TodoView",
      $$moduleId: "worker-components.tsx",
      $$name: "TodoView",
    };
    const RSCLoader = rsc<Record<string, unknown>>(WorkerViewRef as any);

    await renderLoader(RSCLoader, { filter: "all" });
    expect(mocks.fetchRSC).toHaveBeenCalledTimes(1);

    invalidateRSC();
    expect(mocks.stateSetter).toHaveBeenCalledTimes(1);
    await renderLoader(RSCLoader, { filter: "all" });
    expect(mocks.fetchRSC).toHaveBeenCalledTimes(2);

    invalidateRSC();
    expect(mocks.stateSetter).toHaveBeenCalledTimes(2);
    await renderLoader(RSCLoader, { filter: "all" });
    expect(mocks.fetchRSC).toHaveBeenCalledTimes(3);
  });

  it("parents invalidate-triggered rerender spans under the action span", async () => {
    const { invalidateRSC, rsc } = await import("../src/react");
    const WorkerViewRef = {
      $$typeof: Symbol.for("rsc.worker.reference"),
      $$id: "worker-components.tsx#TodoView",
      $$moduleId: "worker-components.tsx",
      $$name: "TodoView",
    };
    const RSCLoader = rsc<Record<string, unknown>>(WorkerViewRef as any);

    await renderLoader(RSCLoader, { filter: "all" });
    const actionSpan = startTraceSpan(
      "rsc.action.call",
      {
        requestId: "action-req-1",
        actionId: "actions#toggle",
        source: "client",
      },
      undefined,
    );
    invalidateRSC({
      causeType: "action-legacy-invalidate",
      requestId: "action-req-1",
      actionId: "actions#toggle",
      parentSpan: actionSpan,
      generation: 1,
      dispatchedAt: Date.now(),
    });
    await renderLoader(RSCLoader, { filter: "all" });
    finishTraceSpanSuccess(actionSpan);

    const action = traceRecorder
      .getSpansByName("rsc.action.call")
      .find((span) => span.payload.requestId === "action-req-1");
    const rerender = traceRecorder
      .getSpansByName("rsc.react.rerender.fetch")
      .find((span) => span.payload.requestId === "action-req-1");
    const invalidate = traceRecorder
      .getSpansByName("rsc.react.invalidate")
      .find((span) => span.payload.requestId === "action-req-1");

    expect(action).toBeDefined();
    expect(rerender).toBeDefined();
    expect(invalidate).toBeDefined();
    expect(traceRecorder.isDescendant(invalidate!.spanId, action!.spanId)).toBe(true);
    expect(traceRecorder.isDescendant(rerender!.spanId, action!.spanId)).toBe(true);
  });

  it("defers bootstrap until RuntimeProvider render and only bootstraps once", async () => {
    const module = await import("../src/react");
    expect(mocks.bootstrapWorkerRuntime).not.toHaveBeenCalled();

    module.RuntimeProvider({ children: null });
    expect(mocks.bootstrapWorkerRuntime).toHaveBeenCalledTimes(1);

    module.RuntimeProvider({ children: null });
    expect(mocks.bootstrapWorkerRuntime).toHaveBeenCalledTimes(1);
  });

  it("stops invalidating after loader cleanup", async () => {
    const { invalidateRSC, rsc } = await import("../src/react");
    const WorkerViewRef = {
      $$typeof: Symbol.for("rsc.worker.reference"),
      $$id: "worker-components.tsx#TodoView",
      $$moduleId: "worker-components.tsx",
      $$name: "TodoView",
    };
    const RSCLoader = rsc<Record<string, unknown>>(WorkerViewRef as any);

    await renderLoader(RSCLoader, { filter: "all" });
    const loaderKey = RSCLoader as unknown as object;
    expect(mocks.cleanupByLoader.get(loaderKey)).toBeTypeOf("function");
    cleanupLoader(loaderKey);

    invalidateRSC();
    expect(mocks.stateSetter).not.toHaveBeenCalled();
  });

  it("registers and unregisters mounted refresh targets", async () => {
    const { rsc } = await import("../src/react");
    const { getRSCRefreshRuntimeOrNull } = await import("../src/runtime-globals");
    const WorkerViewRef = {
      $$typeof: Symbol.for("rsc.worker.reference"),
      $$id: "worker-components.tsx#TodoView",
      $$moduleId: "worker-components.tsx",
      $$name: "TodoView",
    };
    const RSCLoader = rsc<Record<string, unknown>>(WorkerViewRef as any);

    await renderLoader(RSCLoader, { filter: "all" });
    const runtime = getRSCRefreshRuntimeOrNull();
    expect(runtime).not.toBeNull();
    expect(runtime?.collectTargets()).toEqual([
      {
        targetKey: 'worker-components.tsx#TodoView|props:{"filter":"all"}',
        componentId: "worker-components.tsx#TodoView",
        componentProps: { filter: "all" },
      },
    ]);

    cleanupLoader(RSCLoader as unknown as object);
    expect(runtime?.collectTargets()).toEqual([]);
  });

  it("applies one-shot batch rows and per-target errors", async () => {
    const { rsc } = await import("../src/react");
    const { getRSCRefreshRuntimeOrNull } = await import("../src/runtime-globals");
    const WorkerViewRef = {
      $$typeof: Symbol.for("rsc.worker.reference"),
      $$id: "worker-components.tsx#TodoView",
      $$moduleId: "worker-components.tsx",
      $$name: "TodoView",
    };
    const RSCLoader = rsc<Record<string, unknown>>(WorkerViewRef as any);
    const targetKey = 'worker-components.tsx#TodoView|props:{"filter":"all"}';

    await renderLoader(RSCLoader, { filter: "all" });
    mocks.fetchRSC.mockReset();
    const runtime = getRSCRefreshRuntimeOrNull();
    expect(runtime).not.toBeNull();

    const actionSpan = startTraceSpan(
      "rsc.action.call",
      {
        requestId: "batch-req-1",
        actionId: "actions#batch",
        source: "client",
      },
      undefined,
    );

    runtime?.applyBatch(
      {
        seq: 1,
        entries: [
          {
            targetKey,
            rows: [flightModelRow(0, "batched"), flightDoneRow()],
          },
        ],
      },
      {
        causeType: "action-batch-refresh",
        requestId: "batch-req-1",
        actionId: "actions#batch",
        parentSpan: actionSpan,
        generation: 2,
        dispatchedAt: Date.now(),
      },
    );
    await expect(renderLoader(RSCLoader, { filter: "all" })).resolves.toBe("batched");
    expect(mocks.fetchRSC).not.toHaveBeenCalled();

    const applyBatchSpan = traceRecorder
      .getSpansByName("rsc.react.applyBatch")
      .find((span) => span.payload.requestId === "batch-req-1");
    const decodeSpan = traceRecorder
      .getSpansByName("rsc.react.batch.target.decodeRows")
      .find((span) => span.payload.requestId === "batch-req-1");
    expect(actionSpan).toBeDefined();
    expect(applyBatchSpan).toBeDefined();
    expect(decodeSpan).toBeDefined();
    expect(traceRecorder.isDescendant(applyBatchSpan!.spanId, String(actionSpan?.spanId))).toBe(
      true,
    );
    expect(traceRecorder.isDescendant(decodeSpan!.spanId, String(actionSpan?.spanId))).toBe(true);

    runtime?.applyBatch({
      seq: 2,
      entries: [{ targetKey, error: "component failed" }],
    });
    await expect(renderLoader(RSCLoader, { filter: "all" })).rejects.toThrow("component failed");
    expect(mocks.fetchRSC).not.toHaveBeenCalled();
    finishTraceSpanSuccess(actionSpan);
  });

  it("maintains independent cache per loader instance", async () => {
    const { rsc } = await import("../src/react");
    const WorkerViewRef = {
      $$typeof: Symbol.for("rsc.worker.reference"),
      $$id: "worker-components.tsx#TodoView",
      $$moduleId: "worker-components.tsx",
      $$name: "TodoView",
    };
    const LoaderA = rsc<Record<string, unknown>>(WorkerViewRef as any);
    const LoaderB = rsc<Record<string, unknown>>(WorkerViewRef as any);

    await renderLoader(LoaderA, { filter: "all" });
    await renderLoader(LoaderB, { filter: "active" });
    await renderLoader(LoaderA, { filter: "all" });

    expect(mocks.fetchRSC).toHaveBeenCalledTimes(2);
  });

  it("supports non-serializable props without JSON stringify", async () => {
    const { rsc } = await import("../src/react");
    const WorkerViewRef = {
      $$typeof: Symbol.for("rsc.worker.reference"),
      $$id: "worker-components.tsx#TodoView",
      $$moduleId: "worker-components.tsx",
      $$name: "TodoView",
    };
    const RSCLoader = rsc<Record<string, unknown>>(WorkerViewRef as any);
    const circular = {} as { self?: unknown };
    circular.self = circular;

    await expect(renderLoader(RSCLoader, { payload: circular })).resolves.toBeNull();
    await expect(renderLoader(RSCLoader, { payload: circular })).resolves.toBeNull();

    expect(mocks.fetchRSC).toHaveBeenCalledTimes(1);
  });

  it("reuses cache for structurally-equal nested plain-object props", async () => {
    const { rsc } = await import("../src/react");
    const WorkerViewRef = {
      $$typeof: Symbol.for("rsc.worker.reference"),
      $$id: "worker-components.tsx#TodoView",
      $$moduleId: "worker-components.tsx",
      $$name: "TodoView",
    };
    const RSCLoader = rsc<Record<string, unknown>>(WorkerViewRef as any);

    await renderLoader(RSCLoader, { filters: { status: "all", page: 1 } });
    await renderLoader(RSCLoader, { filters: { status: "all", page: 1 } });

    expect(mocks.fetchRSC).toHaveBeenCalledTimes(1);
  });

  it("reuses in-flight promise during repeated suspense retries", async () => {
    const { rsc } = await import("../src/react");
    const pendingPromise = new Promise<null>(() => {});
    mocks.fetchRSC.mockReset();
    mocks.fetchRSC.mockReturnValue(pendingPromise);

    const WorkerViewRef = {
      $$typeof: Symbol.for("rsc.worker.reference"),
      $$id: "worker-components.tsx#TodoView",
      $$moduleId: "worker-components.tsx",
      $$name: "TodoView",
    };
    const RSCLoader = rsc<Record<string, unknown>>(WorkerViewRef as any);
    const loaderKey = RSCLoader as unknown as object;
    mocks.activeLoader = loaderKey;
    const first = RSCLoader({ filter: "all" });
    mocks.activeLoader = loaderKey;
    const second = RSCLoader({ filter: "all" });
    mocks.activeLoader = null;

    expect(first).toBe(second);
    expect(mocks.fetchRSC).toHaveBeenCalledTimes(1);
  });
});
