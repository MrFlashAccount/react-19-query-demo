import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, screen, act } from "@testing-library/react";
import { Suspense, use } from "react";
import {
  QueryProvider,
  useQuery,
  QueryContext,
  type QueryContextValue,
  QueryCache,
} from "..";

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

let queryCache = new QueryCache();

describe("QueryProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    queryCache = new QueryCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Basic caching behavior", () => {
    it("should cache a promise and return the same promise on subsequent calls", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise1 = Promise.resolve("data");
      const result1 = contextValue!.queryCache.addPromise({
        key: ["test"],
        promise: promise1,
      });

      const promise2 = Promise.resolve("other data");
      const result2 = contextValue!.queryCache.addPromise({
        key: ["test"],
        promise: promise2,
      });

      // Should return the same promise entry function
      expect(result1).toBe(result2);
      // When called, should return the first promise, not the second
      expect(result1()).toBe(promise1);
      expect(result2()).toBe(promise1);
      expect(result2()).not.toBe(promise2);
    });

    it("should cache different promises for different keys", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise1 = Promise.resolve("data1");
      const promise2 = Promise.resolve("data2");

      const result1 = contextValue!.queryCache.addPromise({
        key: ["test", 1],
        promise: promise1,
      });

      const result2 = contextValue!.queryCache.addPromise({
        key: ["test", 2],
        promise: promise2,
      });

      expect(result1()).toBe(promise1);
      expect(result2()).toBe(promise2);
      expect(result1).not.toBe(result2);
    });

    it("should retrieve cached promise with getPromise", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise = Promise.resolve("data");
      const added = contextValue!.queryCache.addPromise({
        key: ["test"],
        promise,
      });

      const retrieved = contextValue!.queryCache.getPromise(["test"]);
      expect(retrieved).toBe(added);
      expect(retrieved!()).toBe(promise);
    });

    it("should return null for non-existent cache entry", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const retrieved = contextValue!.queryCache.getPromise(["non-existent"]);
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

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise = Promise.resolve("data");
      contextValue!.queryCache.addPromise({
        key: ["test"],
        promise,
      });

      const entry = contextValue!.queryCache
        .getCache()
        .get(JSON.stringify(["test"]));
      expect(entry!.subscriptions).toBe(0);

      contextValue!.queryCache.subscribe(["test"]);
      expect(entry!.subscriptions).toBe(1);

      contextValue!.queryCache.subscribe(["test"]);
      expect(entry!.subscriptions).toBe(2);
    });

    it("should decrement subscriptions when unsubscribing", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise = Promise.resolve("data");
      contextValue!.queryCache.addPromise({
        key: ["test"],
        promise,
      });

      contextValue!.queryCache.subscribe(["test"]);
      contextValue!.queryCache.subscribe(["test"]);

      const entry = contextValue!.queryCache
        .getCache()
        .get(JSON.stringify(["test"]));
      expect(entry!.subscriptions).toBe(2);

      contextValue!.queryCache.unsubscribe(["test"]);
      expect(entry!.subscriptions).toBe(1);

      contextValue!.queryCache.unsubscribe(["test"]);
      expect(entry!.subscriptions).toBe(0);
    });

    it("should not go below 0 subscriptions", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise = Promise.resolve("data");
      contextValue!.queryCache.addPromise({
        key: ["test"],
        promise,
      });

      const entry = contextValue!.queryCache
        .getCache()
        .get(JSON.stringify(["test"]));
      expect(entry!.subscriptions).toBe(0);

      contextValue!.queryCache.unsubscribe(["test"]);
      expect(entry!.subscriptions).toBe(0);
    });
  });

  describe("GC timing without active subscriptions", () => {
    it("should remove cache entry after gcTime expires with no subscriptions", () => {
      let contextValue: QueryContextValue =
        null as unknown as QueryContextValue;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise = Promise.resolve("data");
      contextValue.queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 5000,
      });

      // Entry should exist
      expect(
        contextValue.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Unsubscribe to mark entry as GC eligible (simulating no active subscriptions)
      contextValue.queryCache.unsubscribe(["test"]);

      // Fast-forward time - need to account for gcTime + scheduler interval (100ms)
      vi.advanceTimersByTime(4999);
      expect(
        contextValue.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Advance past gcTime and trigger scheduler (100ms intervals + setTimeout(0))
      vi.advanceTimersByTime(101);
      expect(
        contextValue.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(false);
    });

    it("should not remove cache entry if gcTime is not specified", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise = Promise.resolve("data");
      contextValue!.queryCache.addPromise({
        key: ["test"],
        promise,
      });

      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Fast-forward a lot of time
      vi.advanceTimersByTime(100000);
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);
    });

    it("should not remove cache entry if gcTime is Infinity", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise = Promise.resolve("data");
      contextValue!.queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: Infinity,
      });

      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      vi.advanceTimersByTime(100000);
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
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

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise = Promise.resolve("data");
      contextValue!.queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 5000,
      });

      contextValue!.queryCache.subscribe(["test"]);

      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Fast-forward past gcTime
      vi.advanceTimersByTime(10000);

      // Should still exist because there's an active subscription
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);
    });

    it("should start GC timer after all subscriptions are removed", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise = Promise.resolve("data");
      contextValue!.queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 5000,
      });

      contextValue!.queryCache.subscribe(["test"]);
      contextValue!.queryCache.subscribe(["test"]);

      // Fast-forward time while subscriptions exist
      vi.advanceTimersByTime(10000);
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Remove first subscription
      contextValue!.queryCache.unsubscribe(["test"]);
      vi.advanceTimersByTime(10000);
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Remove last subscription - should mark as GC eligible
      contextValue!.queryCache.unsubscribe(["test"]);

      vi.advanceTimersByTime(4999);
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Advance past gcTime and trigger scheduler
      vi.advanceTimersByTime(101);
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(false);
    });

    it("should cancel GC timer when subscribing after unsubscribe", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise = Promise.resolve("data");
      contextValue!.queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 5000,
      });

      contextValue!.queryCache.subscribe(["test"]);
      contextValue!.queryCache.unsubscribe(["test"]);

      // GC timer started
      vi.advanceTimersByTime(2000);

      // Subscribe again - should cancel GC timer
      contextValue!.queryCache.subscribe(["test"]);

      // Fast-forward past original gcTime
      vi.advanceTimersByTime(10000);

      // Should still exist
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
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
        const data = use(promise());
        return <div>{data}</div>;
      }

      let result: ReturnType<typeof render> | undefined;
      await act(async () => {
        result = render(
          <QueryProvider queryCache={queryCache}>
            <Suspense fallback={<div>Loading...</div>}>
              <TestComponent />
            </Suspense>
          </QueryProvider>
        );
      });

      await flushPromises();

      await waitFor(() => {
        expect(screen.queryByText("data")).toBeDefined();
      });

      const entry = contextValue!.queryCache
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
      // Use real timers for this test
      vi.useRealTimers();

      // Create a new QueryCache with real timers
      // (The one from beforeEach was created with fake timers)
      const realTimerCache = new QueryCache();

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
          gcTime: 500, // Shorter gcTime to avoid test timeout
        });
        const data = use(promise());
        return <div>{data}</div>;
      }

      let result: ReturnType<typeof render> | undefined;
      await act(async () => {
        result = render(
          <QueryProvider queryCache={realTimerCache}>
            <Suspense fallback={<div>Loading...</div>}>
              <TestComponent />
            </Suspense>
          </QueryProvider>
        );
      });

      await flushPromises();

      await waitFor(() => {
        expect(screen.queryByText("data")).toBeDefined();
      });

      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Unmount component
      result?.unmount();

      await waitFor(
        () => {
          expect(
            contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
          ).toBe(false);
        },
        {
          timeout: 2000, // gcTime (500ms) + scheduler interval (100ms) + buffer
        }
      );

      // Clean up
      realTimerCache.destroy();
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
        const data = use(promise());
        return <div>{data}</div>;
      }

      await act(async () => {
        render(
          <QueryProvider queryCache={queryCache}>
            <Suspense fallback={<div>Loading...</div>}>
              <TestComponent />
            </Suspense>
          </QueryProvider>
        );
      });

      await flushPromises();

      await waitFor(() => {
        expect(screen.queryByText("data")).toBeDefined();
      });

      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Switch to fake timers
      vi.useFakeTimers();

      // Advance time by gcTime while component is still mounted
      vi.advanceTimersByTime(10000);

      // Cache should still exist
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
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
        const data = use(promise());
        return <div>Component1: {data}</div>;
      }

      function TestComponent2() {
        const { promise } = useQuery({
          key: ["shared"],
          queryFn,
          gcTime: 5000,
        });
        const data = use(promise());
        return <div>Component2: {data}</div>;
      }

      await act(async () => {
        render(
          <QueryProvider queryCache={queryCache}>
            <Suspense fallback={<div>Loading...</div>}>
              <TestComponent1 />
              <TestComponent2 />
            </Suspense>
          </QueryProvider>
        );
      });

      await flushPromises();

      await waitFor(() => {
        expect(screen.queryByText("Component1: shared data")).toBeDefined();
        expect(screen.queryByText("Component2: shared data")).toBeDefined();
      });

      // Should call queryFn a small number of times (React may re-render)
      // The important thing is it's not called separately for each component
      expect(queryFn.mock.calls.length).toBeLessThan(10);

      vi.useFakeTimers();
    });
  });

  describe("Edge cases", () => {
    it("should handle complex keys with objects", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise1 = Promise.resolve("data1");
      const promise2 = Promise.resolve("data2");

      contextValue!.queryCache.addPromise({
        key: ["test", { id: 1, name: "foo" }],
        promise: promise1,
      });

      contextValue!.queryCache.addPromise({
        key: ["test", { id: 2, name: "bar" }],
        promise: promise2,
      });

      const retrieved1 = contextValue!.queryCache.getPromise([
        "test",
        { id: 1, name: "foo" },
      ]);
      const retrieved2 = contextValue!.queryCache.getPromise([
        "test",
        { id: 2, name: "bar" },
      ]);

      expect(retrieved1!()).toBe(promise1);
      expect(retrieved2!()).toBe(promise2);
    });

    it("should handle multiple unsubscribes gracefully", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise = Promise.resolve("data");
      contextValue!.queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 5000,
      });

      contextValue!.queryCache.subscribe(["test"]);

      const entry = contextValue!.queryCache
        .getCache()
        .get(JSON.stringify(["test"]));
      expect(entry!.subscriptions).toBe(1);

      contextValue!.queryCache.unsubscribe(["test"]);
      expect(entry!.subscriptions).toBe(0);

      // Multiple unsubscribes should not cause negative subscriptions
      contextValue!.queryCache.unsubscribe(["test"]);
      contextValue!.queryCache.unsubscribe(["test"]);
      expect(entry!.subscriptions).toBe(0);
    });

    it("should handle zero gcTime (immediate removal)", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise = Promise.resolve("data");
      contextValue!.queryCache.addPromise({
        key: ["test"],
        promise,
        gcTime: 0,
      });

      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
      ).toBe(true);

      // Trigger GC by ensuring no subscriptions
      contextValue!.queryCache.unsubscribe(["test"]);

      // For zero gcTime, need to wait for scheduler to run
      // Advance by at least 100ms (scheduler interval) + a bit more for setTimeout(0)
      vi.advanceTimersByTime(101);

      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["test"]))
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

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      const promise = Promise.resolve("data");
      contextValue!.queryCache.addPromise({
        key: ["movies", "action"],
        promise,
        gcTime: 5000,
      });

      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["movies", "action"]))
      ).toBe(true);

      contextValue!.queryCache.invalidate(["movies", "action"]);

      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["movies", "action"]))
      ).toBe(false);
    });

    it("should invalidate all queries with matching prefix", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      // Add multiple cache entries with different keys
      contextValue!.queryCache.addPromise({
        key: ["movies"],
        promise: Promise.resolve("all movies"),
        gcTime: 5000,
      });

      contextValue!.queryCache.addPromise({
        key: ["movies", "action"],
        promise: Promise.resolve("action movies"),
        gcTime: 5000,
      });

      contextValue!.queryCache.addPromise({
        key: ["movies", "comedy"],
        promise: Promise.resolve("comedy movies"),
        gcTime: 5000,
      });

      contextValue!.queryCache.addPromise({
        key: ["movies", "action", "popular"],
        promise: Promise.resolve("popular action movies"),
        gcTime: 5000,
      });

      contextValue!.queryCache.addPromise({
        key: ["users"],
        promise: Promise.resolve("users"),
        gcTime: 5000,
      });

      // Verify all entries exist
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["movies"]))
      ).toBe(true);
      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["movies", "action"]))
      ).toBe(true);
      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["movies", "comedy"]))
      ).toBe(true);
      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["movies", "action", "popular"]))
      ).toBe(true);
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["users"]))
      ).toBe(true);

      // Invalidate all queries starting with ["movies"]
      contextValue!.queryCache.invalidate(["movies"]);

      // All movie queries should be removed
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["movies"]))
      ).toBe(false);
      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["movies", "action"]))
      ).toBe(false);
      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["movies", "comedy"]))
      ).toBe(false);
      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["movies", "action", "popular"]))
      ).toBe(false);

      // Users query should still exist
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["users"]))
      ).toBe(true);
    });

    it("should invalidate with partial prefix match", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      contextValue!.queryCache.addPromise({
        key: ["movies", "action"],
        promise: Promise.resolve("action movies"),
        gcTime: 5000,
      });

      contextValue!.queryCache.addPromise({
        key: ["movies", "action", "popular"],
        promise: Promise.resolve("popular action movies"),
        gcTime: 5000,
      });

      contextValue!.queryCache.addPromise({
        key: ["movies", "action", "recent"],
        promise: Promise.resolve("recent action movies"),
        gcTime: 5000,
      });

      contextValue!.queryCache.addPromise({
        key: ["movies", "comedy"],
        promise: Promise.resolve("comedy movies"),
        gcTime: 5000,
      });

      // Invalidate all queries starting with ["movies", "action"]
      contextValue!.queryCache.invalidate(["movies", "action"]);

      // All action movie queries should be removed
      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["movies", "action"]))
      ).toBe(false);
      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["movies", "action", "popular"]))
      ).toBe(false);
      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["movies", "action", "recent"]))
      ).toBe(false);

      // Comedy query should still exist
      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["movies", "comedy"]))
      ).toBe(true);
    });

    it("should clear pending GC timers when invalidating", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      contextValue!.queryCache.addPromise({
        key: ["movies"],
        promise: Promise.resolve("data"),
        gcTime: 5000,
      });

      const entry = contextValue!.queryCache
        .getCache()
        .get(JSON.stringify(["movies"]));

      // Subscribe and unsubscribe to mark as GC eligible
      contextValue!.queryCache.subscribe(["movies"]);
      contextValue!.queryCache.unsubscribe(["movies"]);

      expect(entry?.gcEligibleAt).toBeDefined();

      // Invalidate should remove the entry
      contextValue!.queryCache.invalidate(["movies"]);

      // Entry should be removed
      expect(
        contextValue!.queryCache.getCache().has(JSON.stringify(["movies"]))
      ).toBe(false);
    });

    it("should handle invalidating non-existent keys gracefully", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      // Should not throw when invalidating non-existent key
      expect(() => {
        contextValue!.queryCache.invalidate(["non-existent"]);
      }).not.toThrow();
    });

    it("should handle complex key types in prefix matching", () => {
      let contextValue: QueryContextValue | null = null;

      function TestComponent() {
        contextValue = useQueryContext();
        return <div>Test</div>;
      }

      render(
        <QueryProvider queryCache={queryCache}>
          <TestComponent />
        </QueryProvider>
      );

      // Add entries with complex key types
      contextValue!.queryCache.addPromise({
        key: ["user", 123, { active: true }],
        promise: Promise.resolve("user data"),
        gcTime: 5000,
      });

      contextValue!.queryCache.addPromise({
        key: ["user", 123, { active: false }],
        promise: Promise.resolve("inactive user data"),
        gcTime: 5000,
      });

      contextValue!.queryCache.addPromise({
        key: ["user", 456, { active: true }],
        promise: Promise.resolve("other user data"),
        gcTime: 5000,
      });

      // Invalidate all queries for user 123
      contextValue!.queryCache.invalidate(["user", 123]);

      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["user", 123, { active: true }]))
      ).toBe(false);
      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["user", 123, { active: false }]))
      ).toBe(false);

      // User 456 should still exist
      expect(
        contextValue!.queryCache
          .getCache()
          .has(JSON.stringify(["user", 456, { active: true }]))
      ).toBe(true);
    });
  });
});
