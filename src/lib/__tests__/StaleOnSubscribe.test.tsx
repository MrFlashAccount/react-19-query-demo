import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, screen, act } from "@testing-library/react";
import { Suspense, use, type ReactElement } from "react";
import {
  QueryProvider,
  useQuery,
  QueryCache,
  useQueryCache,
  type QueryCacheOptions,
} from "..";
import { timerWheel } from "../TimerWheel";

/**
 * Helper to flush all pending promises
 */
async function flushPromises() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Stale data detection on subscribe", () => {
  let queryCache: QueryCache | undefined;

  function QueryCacheCapture() {
    queryCache = useQueryCache();
    return null;
  }

  function getQueryCache(): QueryCache {
    if (queryCache == null) {
      throw new Error("Query cache not initialized");
    }
    return queryCache;
  }

  function renderWithProvider(
    element: ReactElement,
    options: QueryCacheOptions = {}
  ) {
    return render(
      <QueryProvider queryCacheOptions={options}>
        <QueryCacheCapture />
        {element}
      </QueryProvider>
    );
  }

  beforeEach(() => {
    vi.useRealTimers();
    queryCache = undefined;
  });

  afterEach(() => {
    queryCache?.clear();
    timerWheel.clear();
  });

  it("should trigger background refetch when subscribing to stale data", async () => {
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `data-${callCount}`;
    });

    function TestComponent() {
      const { promise } = useQuery({
        key: ["test"],
        queryFn,
        gcTime: 10000,
        staleTime: 50, // Very short stale time
      });
      const data = use(promise!);
      return <div>Data: {data}</div>;
    }

    // First render - should fetch data
    const { unmount } = await act(async () => {
      const result = renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent />
        </Suspense>
      );
      return result;
    });

    await flushPromises();

    await waitFor(() => {
      expect(screen.queryByText("Data: data-1")).toBeDefined();
    });

    unmount();
    expect(callCount).toBe(1);

    // Wait for data to become stale
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify data is stale
    expect(getQueryCache().isStale(["test"])).toBe(true);

    // Second render - should use stale data but trigger background refetch
    const existingCache = new Map(getQueryCache().getCache());

    await act(async () => {
      renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent />
        </Suspense>,
        { cache: existingCache }
      );
    });

    // Should immediately show stale data (no loading state)
    expect(screen.queryByText("Data: data-1")).toBeDefined();

    // Background refetch should have been triggered
    await flushPromises();

    // Wait for the background refetch to complete
    await waitFor(
      () => {
        expect(callCount).toBe(2);
      },
      { timeout: 200 }
    );

    expect(callCount).toBe(2);
  });

  it("should NOT trigger background refetch when data is fresh", async () => {
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `data-${callCount}`;
    });

    function TestComponent() {
      const { promise } = useQuery({
        key: ["test"],
        queryFn,
        gcTime: 10000,
        staleTime: 10000, // Long stale time - data stays fresh
      });
      const data = use(promise!);
      return <div>Data: {data}</div>;
    }

    // First render - should fetch data
    const { unmount } = await act(async () => {
      const result = renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent />
        </Suspense>
      );
      return result;
    });

    await flushPromises();

    await waitFor(() => {
      expect(screen.queryByText("Data: data-1")).toBeDefined();
    });

    unmount();
    expect(callCount).toBe(1);

    // Wait a bit, but not long enough for data to become stale
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify data is still fresh
    expect(getQueryCache().isStale(["test"])).toBe(false);

    // Second render - should use fresh data and NOT trigger background refetch
    const existingCache = new Map(getQueryCache().getCache());

    await act(async () => {
      renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent />
        </Suspense>,
        { cache: existingCache }
      );
    });

    // Should show the cached data
    expect(screen.queryByText("Data: data-1")).toBeDefined();

    await flushPromises();

    // Wait a bit to ensure no background refetch happens
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should still be 1 - no background refetch
    expect(callCount).toBe(1);
  });

  it("should reuse pending promises and not trigger duplicate fetches", async () => {
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return "data";
    });

    function TestComponent1() {
      const { promise } = useQuery({
        key: ["test"],
        queryFn,
        gcTime: 10000,
        staleTime: 10000,
      });
      const data = use(promise!);
      return <div>Component1: {data}</div>;
    }

    function TestComponent2() {
      const { promise } = useQuery({
        key: ["test"],
        queryFn,
        gcTime: 10000,
        staleTime: 10000,
      });
      const data = use(promise!);
      return <div>Component2: {data}</div>;
    }

    // Render both components at the same time - they should share the pending promise
    await act(async () => {
      renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent1 />
          <TestComponent2 />
        </Suspense>
      );
    });

    await flushPromises();

    await waitFor(() => {
      expect(screen.queryByText("Component1: data")).toBeDefined();
      expect(screen.queryByText("Component2: data")).toBeDefined();
    });

    // Should only call queryFn once - both components shared the pending promise
    expect(callCount).toBe(1);
  });

  it("should trigger background refetch with staleTime=0 (default)", async () => {
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `data-${callCount}`;
    });

    function TestComponent() {
      const { promise } = useQuery({
        key: ["test"],
        queryFn,
        gcTime: 10000,
        // staleTime defaults to 0, meaning data is immediately stale
      });
      const data = use(promise!);
      return <div>Data: {data}</div>;
    }

    // First render - should fetch data
    const { unmount } = await act(async () => {
      const result = renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent />
        </Suspense>
      );
      return result;
    });

    await flushPromises();

    await waitFor(() => {
      expect(screen.queryByText("Data: data-1")).toBeDefined();
    });

    unmount();
    expect(callCount).toBe(1);

    // With staleTime=0 (default), data is immediately stale after fetching
    expect(getQueryCache().isStale(["test"])).toBe(true);

    // Second render - should use stale data but trigger background refetch
    const existingCache = new Map(getQueryCache().getCache());

    await act(async () => {
      renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent />
        </Suspense>,
        { cache: existingCache }
      );
    });

    // Should immediately show stale data
    expect(screen.queryByText("Data: data-1")).toBeDefined();

    // Background refetch should have been triggered
    await flushPromises();

    // Wait for the background refetch to complete
    await waitFor(
      () => {
        expect(callCount).toBe(2);
      },
      { timeout: 500 }
    );

    expect(callCount).toBe(2);
  });

  it("should NOT trigger background refetch with staleTime=Infinity", async () => {
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `data-${callCount}`;
    });

    function TestComponent() {
      const { promise } = useQuery({
        key: ["test"],
        queryFn,
        gcTime: 10000,
        staleTime: Infinity, // Never stale
      });
      const data = use(promise!);
      return <div>Data: {data}</div>;
    }

    // First render - should fetch data
    const { unmount } = await act(async () => {
      const result = renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent />
        </Suspense>
      );
      return result;
    });

    await flushPromises();

    await waitFor(() => {
      expect(screen.queryByText("Data: data-1")).toBeDefined();
    });

    unmount();
    expect(callCount).toBe(1);

    // Wait a long time
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Data should never be stale
    expect(getQueryCache().isStale(["test"])).toBe(false);

    // Second render - should use fresh data and NOT trigger background refetch
    const existingCache = new Map(getQueryCache().getCache());

    await act(async () => {
      renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent />
        </Suspense>,
        { cache: existingCache }
      );
    });

    // Should show the cached data
    expect(screen.queryByText("Data: data-1")).toBeDefined();

    await flushPromises();

    // Wait to ensure no background refetch
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should still be 1 - no background refetch with Infinity
    expect(callCount).toBe(1);
  });

  it("should NOT trigger background refetch with staleTime='static'", async () => {
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `data-${callCount}`;
    });

    function TestComponent() {
      const { promise } = useQuery({
        key: ["test"],
        queryFn,
        gcTime: 10000,
        staleTime: "static", // Never stale, never refetch
      });
      const data = use(promise!);
      return <div>Data: {data}</div>;
    }

    // First render - should fetch data
    const { unmount } = await act(async () => {
      const result = renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent />
        </Suspense>
      );
      return result;
    });

    await flushPromises();

    await waitFor(() => {
      expect(screen.queryByText("Data: data-1")).toBeDefined();
    });

    unmount();
    expect(callCount).toBe(1);

    // Data with staleTime='static' is never stale
    await waitFor(() => {
      expect(getQueryCache().isStale(["test"])).toBe(false);
    });

    // Second render - should use cached data and NOT trigger background refetch
    const existingCache = new Map(getQueryCache().getCache());

    await act(async () => {
      renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent />
        </Suspense>,
        { cache: existingCache }
      );
    });

    // Should show the cached data
    expect(screen.queryByText("Data: data-1")).toBeDefined();

    await flushPromises();

    // Wait to ensure no background refetch
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should still be 1 - no background refetch with 'static'
    expect(callCount).toBe(1);
  });

  it("should handle multiple components subscribing to the same stale query", async () => {
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `data-${callCount}`;
    });

    function TestComponent1() {
      const { promise } = useQuery({
        key: ["shared"],
        queryFn,
        gcTime: 10000,
        staleTime: 50,
      });
      const data = use(promise!);
      return <div>Component1: {data}</div>;
    }

    function TestComponent2() {
      const { promise } = useQuery({
        key: ["shared"],
        queryFn,
        gcTime: 10000,
        staleTime: 50,
      });
      const data = use(promise!);
      return <div>Component2: {data}</div>;
    }

    // First render - should fetch data once
    const { unmount } = await act(async () => {
      const result = renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent1 />
          <TestComponent2 />
        </Suspense>
      );
      return result;
    });

    await flushPromises();

    await waitFor(() => {
      expect(screen.queryByText("Component1: data-1")).toBeDefined();
      expect(screen.queryByText("Component2: data-1")).toBeDefined();
    });

    unmount();
    expect(callCount).toBe(1);

    // Wait for data to become stale
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(getQueryCache().isStale(["shared"])).toBe(true);

    // Second render with both components - should trigger background refetch only once
    const existingCache = new Map(getQueryCache().getCache());

    await act(async () => {
      renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent1 />
          <TestComponent2 />
        </Suspense>,
        { cache: existingCache }
      );
    });

    // Both components should show stale data immediately
    expect(screen.queryByText("Component1: data-1")).toBeDefined();
    expect(screen.queryByText("Component2: data-1")).toBeDefined();

    await flushPromises();

    // Wait for background refetch to complete
    await waitFor(
      () => {
        expect(callCount).toBe(2);
      },
      { timeout: 200 }
    );

    // Should only trigger background refetch once, not twice
    expect(callCount).toBe(2);
  });

  it("should update to fresh data after background refetch completes", async () => {
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `data-${callCount}`;
    });

    function TestComponent() {
      const { promise } = useQuery({
        key: ["test"],
        queryFn,
        gcTime: 10000,
        staleTime: 50,
      });
      const data = use(promise!);
      return <div>Data: {data}</div>;
    }

    // First render
    const { unmount } = await act(async () => {
      const result = renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent />
        </Suspense>
      );
      return result;
    });

    await flushPromises();
    await waitFor(() => {
      expect(screen.queryByText("Data: data-1")).toBeDefined();
    });

    unmount();

    // Wait for data to become stale
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Second render - triggers background refetch
    const existingCache = new Map(getQueryCache().getCache());

    await act(async () => {
      renderWithProvider(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent />
        </Suspense>,
        { cache: existingCache }
      );
    });

    // Initially shows stale data
    expect(screen.queryByText("Data: data-1")).toBeDefined();

    // Wait for background refetch to complete and component to update
    await waitFor(
      () => {
        expect(screen.queryByText("Data: data-2")).toBeDefined();
      },
      { timeout: 200 }
    );

    // Should now show fresh data
    expect(screen.queryByText("Data: data-2")).toBeDefined();
    expect(callCount).toBe(2);
  });
});
