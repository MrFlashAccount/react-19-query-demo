import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchRSC: vi.fn(async () => null),
  stateSetter: vi.fn(),
  effectCleanup: null as null | (() => void),
  effectRegistered: false,
}));

vi.mock("../src/client", () => ({
  fetchRSC: mocks.fetchRSC,
}));

vi.mock("react", () => ({
  createContext: (value: unknown) => ({
    _value: value,
    Provider: Symbol("provider"),
  }),
  use: (value: { _value?: unknown }) => value?._value ?? null,
  useEffect: (effect: () => void | (() => void)) => {
    if (mocks.effectRegistered) {
      return;
    }
    mocks.effectRegistered = true;
    const cleanup = effect();
    mocks.effectCleanup = typeof cleanup === "function" ? cleanup : null;
  },
  useState: () => [{}, mocks.stateSetter],
}));

describe("react rsc invalidation", () => {
  beforeEach(() => {
    mocks.fetchRSC.mockReset();
    mocks.fetchRSC.mockResolvedValue(null);
    mocks.stateSetter.mockReset();
    mocks.effectCleanup?.();
    mocks.effectCleanup = null;
    mocks.effectRegistered = false;
    vi.resetModules();
  });

  afterEach(() => {
    mocks.effectCleanup?.();
    mocks.effectCleanup = null;
  });

  it("supports repeated invalidateRSC refresh cycles", async () => {
    const { invalidateRSC, rsc } = await import("../src/react");
    const WorkerViewRef = {
      $$typeof: Symbol.for("rsc.worker.reference"),
      $$id: "worker-components.tsx#TodoView",
      $$moduleId: "worker-components.tsx",
      $$name: "TodoView",
    };
    const RSCLoader = rsc(WorkerViewRef);

    await RSCLoader({ filter: "all" });
    expect(mocks.fetchRSC).toHaveBeenCalledTimes(1);

    invalidateRSC();
    expect(mocks.stateSetter).toHaveBeenCalledTimes(1);
    await RSCLoader({ filter: "all" });
    expect(mocks.fetchRSC).toHaveBeenCalledTimes(2);

    invalidateRSC();
    expect(mocks.stateSetter).toHaveBeenCalledTimes(2);
    await RSCLoader({ filter: "all" });
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
    const RSCLoader = rsc(WorkerViewRef);

    await RSCLoader({ filter: "all" });
    expect(mocks.effectCleanup).not.toBeNull();

    mocks.effectCleanup?.();
    mocks.effectCleanup = null;

    invalidateRSC();
    expect(mocks.stateSetter).not.toHaveBeenCalled();
  });
});
