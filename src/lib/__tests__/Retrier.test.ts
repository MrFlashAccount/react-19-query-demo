import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Retrier } from "../Retrier";
import { timerWheel } from "../TimerWheel";

describe("Retrier", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    timerWheel.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    timerWheel.clear();
  });

  describe("initialization", () => {
    it("should create retrier with default options", () => {
      const retrier = new Retrier();
      expect(retrier).toBeDefined();
      expect(retrier.getRetryConfig()).toBe(true);
    });

    it("should accept number of retries", () => {
      const retrier = new Retrier({ retry: 5 });
      expect(retrier.getRetryConfig()).toBe(5);
    });

    it("should accept boolean retry", () => {
      const retrier = new Retrier({ retry: false });
      expect(retrier.getRetryConfig()).toBe(false);
    });

    it("should accept custom retry function", () => {
      const retryFn = (failureCount: number) => failureCount < 2;
      const retrier = new Retrier({ retry: retryFn });
      expect(retrier.getRetryConfig()).toBe(retryFn);
    });

    it("should accept retry delay", () => {
      const retrier = new Retrier({ retryDelay: 1000 });
      expect(retrier.getRetryDelayConfig()).toBe(1000);
    });

    it("should accept custom retry delay function", () => {
      const delayFn = (failureCount: number) => failureCount * 1000;
      const retrier = new Retrier({ retryDelay: delayFn });
      expect(retrier.getRetryDelayConfig()).toBe(delayFn);
    });
  });

  describe("execute - successful", () => {
    it("should return result on first success", async () => {
      const retrier = new Retrier({ retry: 3 });
      const fn = vi.fn().mockResolvedValue("success");

      const result = await retrier.execute(fn);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledOnce();
    });

    it("should not retry if function succeeds", async () => {
      const retrier = new Retrier({ retry: 5 });
      const fn = vi.fn().mockResolvedValue("data");

      await retrier.execute(fn);

      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe("execute - with number retry", () => {
    it("should retry specified number of times", async () => {
      const retrier = new Retrier({ retry: 3 });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("success");

      const result = await retrier.execute(fn);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should fail after exhausting retries", async () => {
      const retrier = new Retrier({ retry: 2 });
      const error = new Error("persistent failure");
      const fn = vi.fn().mockRejectedValue(error);

      await expect(retrier.execute(fn)).rejects.toThrow("persistent failure");
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it("should not retry if retry is 0", async () => {
      const retrier = new Retrier({ retry: 0 });
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(retrier.execute(fn)).rejects.toThrow("fail");
      expect(fn).toHaveBeenCalledOnce();
    });

    it("should retry up to 10 times", async () => {
      const retrier = new Retrier({ retry: 10 });
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(retrier.execute(fn)).rejects.toThrow("fail");
      expect(fn).toHaveBeenCalledTimes(11); // initial + 10 retries
    });
  });

  describe("execute - with boolean retry", () => {
    it("should retry 3 times when retry is true", async () => {
      const retrier = new Retrier({ retry: true });
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(retrier.execute(fn)).rejects.toThrow("fail");
      expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
    });

    it("should not retry when retry is false", async () => {
      const retrier = new Retrier({ retry: false });
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(retrier.execute(fn)).rejects.toThrow("fail");
      expect(fn).toHaveBeenCalledOnce();
    });

    it("should use default of true (3 retries)", async () => {
      const retrier = new Retrier();
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(retrier.execute(fn)).rejects.toThrow("fail");
      expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
    });
  });

  describe("execute - with custom retry function", () => {
    it("should use custom function to determine retry", async () => {
      const retryFn = vi.fn((failureCount: number) => failureCount < 2);
      const retrier = new Retrier({ retry: retryFn });
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(retrier.execute(fn)).rejects.toThrow("fail");

      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
      expect(retryFn).toHaveBeenCalledTimes(3);
      expect(retryFn).toHaveBeenNthCalledWith(1, 0, expect.any(Error));
      expect(retryFn).toHaveBeenNthCalledWith(2, 1, expect.any(Error));
      expect(retryFn).toHaveBeenNthCalledWith(3, 2, expect.any(Error));
    });

    it("should pass error to retry function", async () => {
      const retryFn = vi.fn((failureCount: number, error: unknown) => {
        if (error instanceof Error && error.message === "network error") {
          return failureCount < 5;
        }
        return false;
      });

      const retrier = new Retrier({ retry: retryFn });
      const networkError = new Error("network error");
      const fn = vi.fn().mockRejectedValue(networkError);

      await expect(retrier.execute(fn)).rejects.toThrow("network error");

      expect(fn).toHaveBeenCalledTimes(6); // initial + 5 retries
    });

    it("should stop retrying when function returns false", async () => {
      let attempts = 0;
      const retryFn = vi.fn(() => {
        attempts++;
        return attempts < 2; // Stop after 1 retry
      });

      const retrier = new Retrier({ retry: retryFn });
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(retrier.execute(fn)).rejects.toThrow("fail");

      expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
    });

    it("should handle async errors correctly", async () => {
      const retryFn = vi.fn((failureCount: number) => failureCount < 1);
      const retrier = new Retrier({ retry: retryFn });

      const fn = vi.fn().mockImplementation(async () => {
        throw new Error("async error");
      });

      await expect(retrier.execute(fn)).rejects.toThrow("async error");

      expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
    });
  });

  describe("retry delay", () => {
    it("should wait specified delay between retries", async () => {
      const retrier = new Retrier({ retry: 2, retryDelay: 1000 });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("success");

      const promise = retrier.execute(fn);

      // Initial call
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // First retry after 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(2);

      // Second retry after another 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe("success");
    });

    it("should not delay if retryDelay is 0", async () => {
      const retrier = new Retrier({ retry: 2, retryDelay: 0 });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockResolvedValue("success");

      const promise = retrier.execute(fn);

      // All retries should happen immediately
      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should use custom delay function", async () => {
      const delayFn = vi.fn((_failureCount: number) => {
        return (_failureCount + 1) * 500;
      });
      const retrier = new Retrier({ retry: 3, retryDelay: delayFn });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("success");

      const promise = retrier.execute(fn);

      // Initial call happens immediately
      await vi.advanceTimersByTimeAsync(1);
      expect(fn).toHaveBeenCalledTimes(1);

      // First retry after 500ms ((0 + 1) * 500)
      await vi.advanceTimersByTimeAsync(500);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(delayFn).toHaveBeenCalledWith(0, expect.any(Error));

      // Second retry after 1000ms ((1 + 1) * 500)
      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(3);
      expect(delayFn).toHaveBeenCalledWith(1, expect.any(Error));

      const result = await promise;
      expect(result).toBe("success");
    });

    it("should pass error to delay function", async () => {
      const delayFn = vi.fn((_failureCount: number, error: unknown) => {
        if (error instanceof Error && error.message.includes("network")) {
          return 2000; // Longer delay for network errors
        }
        return 100;
      });

      const retrier = new Retrier({ retry: 2, retryDelay: delayFn });
      const networkError = new Error("network timeout");
      const fn = vi
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue("success");

      const promise = retrier.execute(fn);

      // Initial call
      await vi.advanceTimersByTimeAsync(1);
      expect(fn).toHaveBeenCalledTimes(1);

      // Should wait 2000ms for network error
      await vi.advanceTimersByTimeAsync(2000);
      expect(fn).toHaveBeenCalledTimes(2);

      const result = await promise;
      expect(result).toBe("success");
      expect(delayFn).toHaveBeenCalledWith(0, networkError);
    });
  });

  describe("edge cases", () => {
    it("should handle non-Error rejections", async () => {
      const retrier = new Retrier({ retry: 1 });
      const fn = vi.fn().mockRejectedValue("string error");

      await expect(retrier.execute(fn)).rejects.toBe("string error");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should handle null rejections", async () => {
      const retrier = new Retrier({ retry: 1 });
      const fn = vi.fn().mockRejectedValue(null);

      await expect(retrier.execute(fn)).rejects.toBe(null);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should handle object rejections", async () => {
      const retrier = new Retrier({ retry: 1 });
      const errorObj = { code: 404, message: "Not found" };
      const fn = vi.fn().mockRejectedValue(errorObj);

      await expect(retrier.execute(fn)).rejects.toBe(errorObj);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should preserve rejection value", async () => {
      const retrier = new Retrier({ retry: 2 });
      const originalError = new Error("original");
      const fn = vi.fn().mockRejectedValue(originalError);

      try {
        await retrier.execute(fn);
      } catch (error) {
        expect(error).toBe(originalError);
      }
    });

    it("should work with synchronous errors", async () => {
      const retrier = new Retrier({ retry: 2 });
      const fn = vi.fn().mockImplementation(() => {
        throw new Error("sync error");
      });

      await expect(retrier.execute(fn)).rejects.toThrow("sync error");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should handle success after multiple retries", async () => {
      const retrier = new Retrier({ retry: 5 });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("1"))
        .mockRejectedValueOnce(new Error("2"))
        .mockRejectedValueOnce(new Error("3"))
        .mockRejectedValueOnce(new Error("4"))
        .mockResolvedValue("finally success");

      const result = await retrier.execute(fn);

      expect(result).toBe("finally success");
      expect(fn).toHaveBeenCalledTimes(5);
    });
  });

  describe("type safety", () => {
    it("should preserve return type", async () => {
      const retrier = new Retrier({ retry: 3 });

      const fn = vi.fn(() =>
        Promise.resolve({
          id: 1,
          name: "Test User",
        } as const)
      );

      const result = await retrier.execute(fn);

      // TypeScript should know result has id and name
      expect(result.id).toBe(1);
      expect(result.name).toBe("Test User");
    });

    it("should work with different return types", async () => {
      const retrier = new Retrier({ retry: 2 });

      const numberFn = vi.fn().mockResolvedValue(42);
      const stringFn = vi.fn().mockResolvedValue("hello");
      const arrayFn = vi.fn().mockResolvedValue([1, 2, 3]);

      expect(await retrier.execute(numberFn)).toBe(42);
      expect(await retrier.execute(stringFn)).toBe("hello");
      expect(await retrier.execute(arrayFn)).toEqual([1, 2, 3]);
    });
  });

  describe("concurrent executions", () => {
    it("should handle multiple concurrent executions", async () => {
      const retrier = new Retrier({ retry: 2 });

      const fn1 = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("result1");
      const fn2 = vi.fn().mockResolvedValue("result2");
      const fn3 = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("result3");

      const [result1, result2, result3] = await Promise.all([
        retrier.execute(fn1),
        retrier.execute(fn2),
        retrier.execute(fn3),
      ]);

      expect(result1).toBe("result1");
      expect(result2).toBe("result2");
      expect(result3).toBe("result3");
      expect(fn1).toHaveBeenCalledTimes(2);
      expect(fn2).toHaveBeenCalledOnce();
      expect(fn3).toHaveBeenCalledTimes(2);
    });
  });
});
