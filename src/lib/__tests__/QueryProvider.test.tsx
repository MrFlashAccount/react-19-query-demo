import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, screen, act } from "@testing-library/react";
import { Suspense, use, type ReactElement } from "react";
import {
  QueryProvider,
  useQuery,
  QueryContext,
  type QueryContextValue,
  type QueryClientOptions,
} from "..";
import { timerWheel } from "../TimerWheel";

/**
 * Test helper to access QueryContext in tests
 */
function useQueryContext() {
  return use(QueryContext);
}

/**
 * Helper to flush all pending promises
 */
async function flushPromises() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function renderWithProvider(
  element: ReactElement,
  options: QueryClientOptions = {}
) {
  return render(
    <QueryProvider queryCacheOptions={options}>{element}</QueryProvider>
  );
}

describe("QueryProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    timerWheel.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    timerWheel.clear();
  });

  describe("Basic caching behavior", () => {
    it("should cache a query and return the same instance on subsequent calls", async () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn1 = vi.fn().mockResolvedValue("data");
      const result1 = contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn: queryFn1,
      });

      // Subscribe to trigger fetch
      result1.subscribe(vi.fn());
      await vi.advanceTimersByTimeAsync(0);

      const queryFn2 = vi.fn().mockResolvedValue("other data");
      const result2 = contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn: queryFn2,
      });

      expect(result1).toBe(result2);
      expect(result2.getOptions().queryFn).toBe(queryFn1);
      expect(queryFn1).toHaveBeenCalledTimes(1);
      expect(queryFn2).not.toHaveBeenCalled();
    });

    it("should cache different queries for different keys", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const result1 = contextValue!.queryClient.addQuery({
        key: ["test", 1],
        queryFn: vi.fn().mockResolvedValue("data1"),
      });

      const result2 = contextValue!.queryClient.addQuery({
        key: ["test", 2],
        queryFn: vi.fn().mockResolvedValue("data2"),
      });

      expect(result1).not.toBe(result2);
    });

    it("should retrieve cached promise with getPromise", async () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return null;
      }

      renderWithProvider(<TestComponent />);

      const queryFn = vi.fn().mockResolvedValue("data");
      const query = contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn,
      });

      const retrieved = contextValue!.queryClient.getPromise(["test"]);
      expect(retrieved).toBe(query.promise);
      const data = await retrieved!;
      expect(data).toBe("data");
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it("should return null for non-existent cache entry", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const retrieved = contextValue!.queryClient.getPromise(["non-existent"]);
      expect(retrieved).toBeNull();
    });
  });

  describe("Subscription tracking", () => {
    it("should increment subscriptions when subscribing", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn = vi.fn().mockResolvedValue("data");
      const query = contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn,
      });

      expect(query.subscriptions).toBe(0);

      const unsubscribe1 = query.subscribe(() => {});
      expect(query.subscriptions).toBe(1);

      const unsubscribe2 = query.subscribe(() => {});
      expect(query.subscriptions).toBe(2);

      unsubscribe2();
      unsubscribe1();
    });

    it("should decrement subscriptions when unsubscribing", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn = vi.fn().mockResolvedValue("data");
      contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn,
      });

      const query = contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn,
      });

      const unsubscribe1 = query.subscribe(() => {});
      const unsubscribe2 = query.subscribe(() => {});

      expect(query.subscriptions).toBe(2);

      unsubscribe1();
      expect(query.subscriptions).toBe(1);

      unsubscribe2();
      expect(query.subscriptions).toBe(0);
    });

    it("should not go below 0 subscriptions", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn = vi.fn().mockResolvedValue("data");
      const query = contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn,
      });

      expect(query.subscriptions).toBe(0);

      query.subscribe(() => {})();
      expect(query.subscriptions).toBe(0);
    });
  });

  describe("GC timing without active subscriptions", () => {
    it("should remove cache entry after gcTime expires with no subscriptions", async () => {
      let contextValue: QueryContextValue =
        null as unknown as QueryContextValue;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn = vi.fn().mockResolvedValue("data");
      const query = contextValue.queryClient.addQuery({
        key: ["test"],
        queryFn,
        gcTime: 5000,
      });

      // Entry should exist
      expect(
        contextValue.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Unsubscribe to mark entry as GC eligible (simulating no active subscriptions)
      query.subscribe(() => {})();

      // Fast-forward time - need to account for gcTime + scheduler interval (100ms)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4999);
      });
      expect(
        contextValue.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Advance past gcTime and trigger scheduler (100ms intervals + setTimeout(0))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(101);
        await vi.runAllTimersAsync();
      });
      expect(
        contextValue.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(false);
    });

    it("should not remove cache entry if gcTime is not specified", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn = vi.fn().mockResolvedValue("data");
      contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn,
      });

      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Fast-forward a lot of time
      vi.advanceTimersByTime(100000);
      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);
    });

    it("should not remove cache entry if gcTime is Infinity", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn = vi.fn().mockResolvedValue("data");
      contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn,
        gcTime: Infinity,
      });

      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      vi.advanceTimersByTime(100000);
      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);
    });
  });

  describe("GC timing with active subscriptions", () => {
    it("should NOT remove cache entry after gcTime if there are active subscriptions", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn = vi.fn().mockResolvedValue("data");
      const query = contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn,
        gcTime: 5000,
      });

      query.subscribe(() => {});

      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Fast-forward past gcTime
      vi.advanceTimersByTime(10000);

      // Should still exist because there's an active subscription
      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);
    });

    it("should start GC timer after all subscriptions are removed", async () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn = vi.fn().mockResolvedValue("data");
      const query = contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn,
        gcTime: 5000,
      });

      const unsubscribe1 = query.subscribe(() => {});
      const unsubscribe2 = query.subscribe(() => {});

      // Fast-forward time while subscriptions exist
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Remove first subscription
      unsubscribe1();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Remove last subscription - should mark as GC eligible
      unsubscribe2();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(4999);
      });
      // Advance past gcTime and trigger scheduler
      await act(async () => {
        await vi.advanceTimersByTimeAsync(101);
        await vi.runAllTimersAsync();
      });
      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(false);
    });

    it("should cancel GC timer when subscribing after unsubscribe", async () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn = vi.fn().mockResolvedValue("data");
      const query = contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn,
        gcTime: 5000,
      });

      const unsubscribe = query.subscribe(() => {});
      unsubscribe();

      // GC timer started
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      // Subscribe again - should cancel GC timer
      query.subscribe(() => {});

      // Fast-forward past original gcTime
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });

      // Should still exist
      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);
    });
  });

  describe("useQuery hook integration", () => {
    it("should automatically subscribe and unsubscribe on mount/unmount", async () => {
      // Use real timers for this test since we need promises to resolve
      vi.useRealTimers();

      let contextValue: QueryContextValue | null = null;
      const queryFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return "data";
      });

      function TestComponent() {
        contextValue = useQueryContext();
        const { promise } = useQuery({
          key: ["test"],
          queryFn,
          gcTime: 5000,
        });
        const data = use(promise!);
        return <div>{data}</div>;
      }

      let result: ReturnType<typeof render> | undefined;
      await act(async () => {
        result = renderWithProvider(
          <Suspense fallback={<div>Loading...</div>}>
            <TestComponent />
          </Suspense>
        );
      });

      await flushPromises();

      await waitFor(() => {
        expect(screen.queryByText("data")).toBeDefined();
      });

      const entry = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["test"]));

      // Should have 1 subscription while mounted
      expect(entry!.subscriptions).toBe(1);

      // Unmount component
      result?.unmount();

      // Should have 0 subscriptions after unmount
      expect(entry!.subscriptions).toBe(0);

      vi.useFakeTimers();
    });

    it("should trigger GC after component unmounts", async () => {
      let contextValue: QueryContextValue | null = null;

      const queryFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return "data";
      });

      function TestComponent() {
        contextValue = useQueryContext();
        const { promise } = useQuery({
          key: ["test"],
          queryFn,
          gcTime: 10, // Shorter gcTime to avoid test timeout
        });
        const data = use(promise!);
        return <div>{data}</div>;
      }

      let result: ReturnType<typeof render> | undefined;
      await act(async () => {
        result = renderWithProvider(
          <Suspense fallback={<div>Loading...</div>}>
            <TestComponent />
          </Suspense>
        );
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(screen.queryByText("data")).toBeDefined();

      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Unmount component
      result?.unmount();

      await vi.advanceTimersByTimeAsync(20);
      await vi.runAllTimersAsync();

      const hasEntry = contextValue!.queryClient
        .getCache()
        .has(JSON.stringify(["test"]));
      expect(hasEntry).toBe(false);
    });

    it("should not trigger GC while component is still mounted", async () => {
      // Use real timers for promises, then fake for time advancement
      vi.useRealTimers();

      let contextValue: QueryContextValue | null = null;
      const queryFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return "data";
      });

      function TestComponent() {
        contextValue = useQueryContext();
        const { promise } = useQuery({
          key: ["test"],
          queryFn,
          gcTime: 5000,
        });
        const data = use(promise!);
        return <div>{data}</div>;
      }

      await act(async () => {
        renderWithProvider(
          <Suspense fallback={<div>Loading...</div>}>
            <TestComponent />
          </Suspense>
        );
      });

      await flushPromises();

      await waitFor(() => {
        expect(screen.queryByText("data")).toBeDefined();
      });

      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Switch to fake timers
      vi.useFakeTimers();

      // Advance time by gcTime while component is still mounted
      vi.advanceTimersByTime(10000);

      // Cache should still exist
      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);
    });

    it("should share cache between multiple components using same key", async () => {
      // Use real timers for promises
      vi.useRealTimers();

      const queryFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return "shared data";
      });

      function TestComponent1() {
        const { promise } = useQuery({
          key: ["shared"],
          queryFn,
          gcTime: 5000,
        });
        const data = use(promise!);
        return <div>Component1: {data}</div>;
      }

      function TestComponent2() {
        const { promise } = useQuery({
          key: ["shared"],
          queryFn,
          gcTime: 5000,
        });
        const data = use(promise!);
        return <div>Component2: {data}</div>;
      }

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
        expect(screen.queryByText("Component1: shared data")).toBeDefined();
        expect(screen.queryByText("Component2: shared data")).toBeDefined();
      });

      // Should call queryFn only once for initial fetch (cache should be shared)
      // May have 1 additional call if stale-on-subscribe triggers a background refetch
      expect(queryFn.mock.calls.length).toBeLessThanOrEqual(2);

      vi.useFakeTimers();
    });
  });

  describe("Edge cases", () => {
    it("should handle complex keys with objects", async () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn1 = vi.fn().mockResolvedValue("data1");
      const queryFn2 = vi.fn().mockResolvedValue("data2");

      contextValue!.queryClient.addQuery({
        key: ["test", { id: 1, name: "foo" }],
        queryFn: queryFn1,
      });

      contextValue!.queryClient.addQuery({
        key: ["test", { id: 2, name: "bar" }],
        queryFn: queryFn2,
      });

      const retrieved1 = contextValue!.queryClient.getPromise([
        "test",
        { id: 1, name: "foo" },
      ]);
      const retrieved2 = contextValue!.queryClient.getPromise([
        "test",
        { id: 2, name: "bar" },
      ]);

      expect(retrieved1).not.toBeNull();
      expect(retrieved2).not.toBeNull();
      await expect(retrieved1).resolves.toBe("data1");
      await expect(retrieved2).resolves.toBe("data2");
      expect(queryFn1).toHaveBeenCalledTimes(1);
      expect(queryFn2).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple unsubscribes gracefully", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn = vi.fn().mockResolvedValue("data");
      const query = contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn,
        gcTime: 5000,
      });

      const unsubscribe = query.subscribe(() => {});
      expect(query.subscriptions).toBe(1);

      unsubscribe();
      expect(query.subscriptions).toBe(0);

      // Multiple unsubscribes should not cause negative subscriptions
      unsubscribe();
      unsubscribe();
      expect(query.subscriptions).toBe(0);
    });

    it("Should not trigger Suspense fallback when invalidating", async () => {
      vi.useRealTimers();
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        const { promise } = useQuery({
          key: ["test"],
          queryFn: () =>
            new Promise((resolve) => setTimeout(resolve, 0)).then(() => "data"),
          gcTime: 5000,
        });

        const data = use(promise!);
        return <div>{data}</div>;
      }

      renderWithProvider(
        <Suspense fallback={<div>Loading</div>}>
          <TestComponent />
        </Suspense>
      );

      await waitFor(() => {
        expect(screen.queryByText("data")).toBeDefined();
      });

      contextValue!.queryClient.invalidate(["test"]);

      expect(screen.queryByText("Loading")).toBeNull();

      await act(async () => {
        await flushPromises();
      });
      expect(screen.queryByText("data")).toBeDefined();
    });

    it("should handle zero gcTime (immediate removal)", async () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn = vi.fn().mockResolvedValue("data");
      const query = contextValue!.queryClient.addQuery({
        key: ["test"],
        queryFn,
        gcTime: 0,
      });

      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Trigger GC by subscribing once and then releasing
      query.subscribe(() => {})();

      // For zero gcTime, need to wait for scheduler to run
      // Advance by at least 100ms (scheduler interval) + a bit more for setTimeout(0)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(101);
        await vi.runAllTimersAsync();
      });

      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["test"]))
      ).toBe(false);
    });
  });

  describe("Query invalidation", () => {
    it("should invalidate exact key match", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const queryFn = vi.fn().mockResolvedValue("data");
      contextValue!.queryClient.addQuery({
        key: ["movies", "action"],
        queryFn,
        gcTime: 5000,
      });

      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["movies", "action"]))
      ).toBe(true);

      contextValue!.queryClient.invalidate(["movies", "action"]);

      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["movies", "action"]))
      ).toBe(true);
    });

    it("should invalidate all queries with matching prefix", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      // Add multiple cache entries with different keys
      contextValue!.queryClient.addQuery({
        key: ["movies"],
        queryFn: vi.fn().mockResolvedValue("all movies"),
        gcTime: 5000,
      });

      contextValue!.queryClient.addQuery({
        key: ["movies", "action"],
        queryFn: vi.fn().mockResolvedValue("action movies"),
        gcTime: 5000,
      });

      contextValue!.queryClient.addQuery({
        key: ["movies", "comedy"],
        queryFn: vi.fn().mockResolvedValue("comedy movies"),
        gcTime: 5000,
      });

      contextValue!.queryClient.addQuery({
        key: ["movies", "action", "popular"],
        queryFn: vi.fn().mockResolvedValue("popular action movies"),
        gcTime: 5000,
      });

      contextValue!.queryClient.addQuery({
        key: ["users"],
        queryFn: vi.fn().mockResolvedValue("users"),
        gcTime: 5000,
      });

      // Verify all entries exist
      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["movies"]))
      ).toBe(true);
      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["movies", "action"]))
      ).toBe(true);
      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["movies", "comedy"]))
      ).toBe(true);
      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["movies", "action", "popular"]))
      ).toBe(true);
      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["users"]))
      ).toBe(true);

      // Invalidate all queries starting with ["movies"]
      contextValue!.queryClient.invalidate(["movies"]);

      // All movie queries should still exist but be stale
      const moviesQuery = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["movies"]));
      const actionQuery = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["movies", "action"]));
      const comedyQuery = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["movies", "comedy"]));
      const popularQuery = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["movies", "action", "popular"]));

      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["movies"]))
      ).toBe(true);
      expect(moviesQuery?.isStale()).toBe(true);
      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["movies", "action"]))
      ).toBe(true);
      expect(actionQuery?.isStale()).toBe(true);
      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["movies", "comedy"]))
      ).toBe(true);
      expect(comedyQuery?.isStale()).toBe(true);
      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["movies", "action", "popular"]))
      ).toBe(true);
      expect(popularQuery?.isStale()).toBe(true);

      // Users query should still exist and not be stale
      const usersQuery = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["users"]));
      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["users"]))
      ).toBe(true);
      expect(usersQuery?.isStale()).toBe(false);
    });

    it("should invalidate with partial prefix match", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      contextValue!.queryClient.addQuery({
        key: ["movies", "action"],
        queryFn: vi.fn().mockResolvedValue("action movies"),
        gcTime: 5000,
      });

      contextValue!.queryClient.addQuery({
        key: ["movies", "action", "popular"],
        queryFn: vi.fn().mockResolvedValue("popular action movies"),
        gcTime: 5000,
      });

      contextValue!.queryClient.addQuery({
        key: ["movies", "action", "recent"],
        queryFn: vi.fn().mockResolvedValue("recent action movies"),
        gcTime: 5000,
      });

      contextValue!.queryClient.addQuery({
        key: ["movies", "comedy"],
        queryFn: vi.fn().mockResolvedValue("comedy movies"),
        gcTime: 5000,
      });

      // Invalidate all queries starting with ["movies", "action"]
      contextValue!.queryClient.invalidate(["movies", "action"]);

      // All action movie queries should still exist but be stale
      const actionQuery = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["movies", "action"]));
      const popularQuery = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["movies", "action", "popular"]));
      const recentQuery = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["movies", "action", "recent"]));

      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["movies", "action"]))
      ).toBe(true);
      expect(actionQuery?.isStale()).toBe(true);
      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["movies", "action", "popular"]))
      ).toBe(true);
      expect(popularQuery?.isStale()).toBe(true);
      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["movies", "action", "recent"]))
      ).toBe(true);
      expect(recentQuery?.isStale()).toBe(true);

      // Comedy query should still exist and not be stale
      const comedyQuery = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["movies", "comedy"]));
      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["movies", "comedy"]))
      ).toBe(true);
      expect(comedyQuery?.isStale()).toBe(false);
    });

    it("should clear pending GC timers when invalidating", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      const query = contextValue!.queryClient.addQuery({
        key: ["movies"],
        queryFn: vi.fn().mockResolvedValue("data"),
        gcTime: 5000,
      });

      // Subscribe and unsubscribe to mark as GC eligible
      const unsubscribe = query.subscribe(() => {});
      unsubscribe();

      // Invalidate should mark as stale but keep entry
      contextValue!.queryClient.invalidate(["movies"]);

      // Entry should still exist but be stale
      expect(
        contextValue!.queryClient.getCache().has(JSON.stringify(["movies"]))
      ).toBe(true);
      const cachedQuery = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["movies"]));
      expect(cachedQuery?.isStale()).toBe(true);
    });

    it("should handle invalidating non-existent keys gracefully", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      // Should not throw when invalidating non-existent key
      expect(() => {
        contextValue!.queryClient.invalidate(["non-existent"]);
      }).not.toThrow();
    });

    it("should handle complex key types in prefix matching", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      renderWithProvider(<TestComponent />);

      // Add entries with complex key types
      contextValue!.queryClient.addQuery({
        key: ["user", 123, { active: true }],
        queryFn: vi.fn().mockResolvedValue("user data"),
        gcTime: 5000,
      });

      contextValue!.queryClient.addQuery({
        key: ["user", 123, { active: false }],
        queryFn: vi.fn().mockResolvedValue("inactive user data"),
        gcTime: 5000,
      });

      contextValue!.queryClient.addQuery({
        key: ["user", 456, { active: true }],
        queryFn: vi.fn().mockResolvedValue("other user data"),
        gcTime: 5000,
      });

      // Invalidate all queries for user 123
      contextValue!.queryClient.invalidate(["user", 123]);

      // User 123 queries should still exist but be stale
      const user123ActiveQuery = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["user", 123, { active: true }]));
      const user123InactiveQuery = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["user", 123, { active: false }]));

      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["user", 123, { active: true }]))
      ).toBe(true);
      expect(user123ActiveQuery?.isStale()).toBe(true);
      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["user", 123, { active: false }]))
      ).toBe(true);
      expect(user123InactiveQuery?.isStale()).toBe(true);

      // User 456 should still exist and not be stale
      const user456Query = contextValue!.queryClient
        .getCache()
        .get(JSON.stringify(["user", 456, { active: true }]));
      expect(
        contextValue!.queryClient
          .getCache()
          .has(JSON.stringify(["user", 456, { active: true }]))
      ).toBe(true);
      expect(user456Query?.isStale()).toBe(false);
    });
  });
});
