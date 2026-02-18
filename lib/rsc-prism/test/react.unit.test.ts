import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchRSC: vi.fn(async () => null),
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
  bootstrapWorkerRuntime: vi.fn(async () => ({
    worker: {} as Worker,
    transport: { sendAction: vi.fn() },
    dispose: vi.fn(),
  })),
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
  beforeEach(() => {
    mocks.fetchRSC.mockReset();
    mocks.fetchRSC.mockResolvedValue(null);
    mocks.stateSetter.mockReset();
    mocks.startTransition.mockClear();
    mocks.activeLoader = null;
    mocks.refsByLoader = new WeakMap<object, { current: unknown }>();
    mocks.cleanupByLoader = new WeakMap<object, () => void>();
    mocks.effectRegisteredByLoader = new WeakSet<object>();
    mocks.seenLoaders.clear();
    vi.resetModules();
  });

  afterEach(() => {
    for (const loader of mocks.seenLoaders) {
      cleanupLoader(loader);
    }
    mocks.seenLoaders.clear();
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
