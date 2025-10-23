import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PromiseEntryFactory, type PromiseEntry } from "../PromiseEntry";

describe("PromiseEntry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("creation", () => {
    it("should create a promise entry with pending status", () => {
      const promise = Promise.resolve("data");
      const entry = PromiseEntryFactory.create(promise);

      expect(entry.status).toBe("pending");
      expect(entry.isPending).toBe(true);
      expect(entry.isFulfilled).toBe(false);
      expect(entry.isRejected).toBe(false);
      expect(entry.data).toBeUndefined();
      expect(entry.error).toBeUndefined();
      expect(entry.timestamp).toBeDefined();
    });

    it("should create a callable function that returns the original promise", () => {
      const promise = Promise.resolve("data");
      const entry = PromiseEntryFactory.create(promise);

      expect(entry()).toBe(promise);
    });

    it("should accept gcTime option", () => {
      const promise = Promise.resolve("data");
      const entry = PromiseEntryFactory.create(promise, { gcTime: 5000 });

      expect(entry.gcTime).toBe(5000);
    });

    it("should create entry without gcTime when not specified", () => {
      const promise = Promise.resolve("data");
      const entry = PromiseEntryFactory.create(promise);

      expect(entry.gcTime).toBeUndefined();
    });
  });

  describe("promise resolution", () => {
    it("should update status to fulfilled when promise resolves", async () => {
      const promise = Promise.resolve("data");
      const entry = PromiseEntryFactory.create(promise);

      expect(entry.status).toBe("pending");

      await promise;

      expect(entry.status).toBe("fulfilled");
      expect(entry.isPending).toBe(false);
      expect(entry.isFulfilled).toBe(true);
      expect(entry.isRejected).toBe(false);
      expect(entry.data).toBe("data");
      expect(entry.error).toBeUndefined();
    });

    it("should update status to rejected when promise rejects", async () => {
      const error = new Error("test error");
      const promise = Promise.reject(error);
      const entry = PromiseEntryFactory.create(promise);

      expect(entry.status).toBe("pending");

      try {
        await promise;
      } catch (e) {
        // Expected to throw
      }

      expect(entry.status).toBe("rejected");
      expect(entry.isPending).toBe(false);
      expect(entry.isFulfilled).toBe(false);
      expect(entry.isRejected).toBe(true);
      expect(entry.data).toBeUndefined();
      expect(entry.error).toBe(error);
    });

    it("should call onStatusChange callback when status changes", async () => {
      const onStatusChange = vi.fn();
      const promise = Promise.resolve("data");
      const entry = PromiseEntryFactory.create(promise, { onStatusChange });

      expect(onStatusChange).not.toHaveBeenCalled();

      await promise;

      expect(onStatusChange).toHaveBeenCalledOnce();
      expect(onStatusChange).toHaveBeenCalledWith(
        "pending",
        "fulfilled",
        entry
      );
    });

    it("should call onStatusChange callback when promise rejects", async () => {
      const onStatusChange = vi.fn();
      const error = new Error("test error");
      const promise = Promise.reject(error);
      const entry = PromiseEntryFactory.create(promise, { onStatusChange });

      expect(onStatusChange).not.toHaveBeenCalled();

      try {
        await promise;
      } catch (e) {
        // Expected to throw
      }

      expect(onStatusChange).toHaveBeenCalledOnce();
      expect(onStatusChange).toHaveBeenCalledWith("pending", "rejected", entry);
    });

    it("should preserve promise value through the function call", async () => {
      const promise = Promise.resolve({ foo: "bar" });
      const entry = PromiseEntryFactory.create(promise);

      const result = await entry();

      expect(result).toEqual({ foo: "bar" });
      expect(entry.data).toEqual({ foo: "bar" });
    });

    it("should preserve promise rejection through the function call", async () => {
      const error = new Error("test error");
      const promise = Promise.reject(error);
      const entry = PromiseEntryFactory.create(promise);

      await expect(entry()).rejects.toThrow("test error");
      expect(entry.error).toBe(error);
    });
  });

  describe("metadata", () => {
    it("should preserve metadata field", () => {
      const promise = Promise.resolve("data");
      const entry = PromiseEntryFactory.create(promise);

      entry.metadata = { custom: "value" };

      expect(entry.metadata).toEqual({ custom: "value" });
    });
  });

  describe("timestamp", () => {
    it("should set timestamp to current time", () => {
      const now = Date.now();
      const promise = Promise.resolve("data");
      const entry = PromiseEntryFactory.create(promise);

      expect(entry.timestamp).toBe(now);
    });

    it("should have different timestamps for entries created at different times", async () => {
      const promise1 = Promise.resolve("data1");
      const entry1 = PromiseEntryFactory.create(promise1);

      vi.advanceTimersByTime(100);

      const promise2 = Promise.resolve("data2");
      const entry2 = PromiseEntryFactory.create(promise2);

      expect(entry2.timestamp).toBe(entry1.timestamp + 100);
    });
  });

  describe("type safety", () => {
    it("should preserve promise value type", async () => {
      const promise = Promise.resolve({ id: 1, name: "test" });
      const entry: PromiseEntry<{ id: number; name: string }> =
        PromiseEntryFactory.create(promise);

      await promise;

      // TypeScript should know that data has the correct shape
      expect(entry.data?.id).toBe(1);
      expect(entry.data?.name).toBe("test");
    });

    it("should allow any error type", async () => {
      const error = { code: 404, message: "Not found" };
      const promise = Promise.reject(error);
      const entry = PromiseEntryFactory.create(promise);

      try {
        await promise;
      } catch (e) {
        // Expected to throw
      }

      expect(entry.error).toEqual({ code: 404, message: "Not found" });
    });
  });
});
