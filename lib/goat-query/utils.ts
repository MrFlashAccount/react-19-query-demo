import { brand } from "lib/brand";

export const noop = (..._args: any[]) => {};
export const noopcb = () => noop;
export const noopAsync = async (..._args: any[]) => {};

/**
 * Exponential backoff formula:
 * base * 2^(attempts - 1)
 * @param base - The base delay
 * @param attempts - The number of attempts
 * @param max - The maximum delay
 * @returns The delay
 */
export function exponentialBackoff(
  base: number,
  attempts: number,
  max: number = Infinity
): number {
  return Math.min(base * 2 ** (attempts - 1), max);
}

/**
 * Serialize query parameters into a stable string representation for cache keys.
 * Objects are sorted by keys to ensure consistent serialization.
 *
 * @param params - The parameters to serialize
 * @returns Serialized string representation
 */

export const SerializedParams = brand<string, "SerializedParams">();
export type SerializedParams = ReturnType<typeof SerializedParams>;

export function serializeParams(params: unknown): SerializedParams {
  if (params === undefined || params === null) {
    return SerializedParams("__void__");
  }

  return SerializedParams(
    JSON.stringify(params, (_, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const sorted = Object.entries(value).sort((a, b) => {
          if (a[0] < b[0]) return -1;
          if (a[0] > b[0]) return 1;
          return 0;
        });

        return sorted;
      }

      return value;
    })
  );
}

export function serializePayload(
  payload: Record<string, unknown> | undefined | null
): string {
  if (payload === undefined || payload === null) {
    return "";
  }

  return JSON.stringify(payload, (_, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof Error) {
      return {
        message: value.message,
        stack: value.stack,
        name: value.name,
      };
    }

    if (value instanceof Promise) {
      return "<Promise>";
    }

    if (value instanceof Set) {
      return Array.from(value);
    }

    if (value instanceof Map) {
      return Object.fromEntries(value);
    }

    if (typeof value === "symbol") {
      return `Symbol(${value.toString()})`;
    }

    if (typeof value === "function") {
      return `Function:${value.name ?? "anonymous"}`;
    }

    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, value]) => [
          key,
          serializePayload(value as Record<string, unknown>),
        ])
      );
    }

    return value;
  });
}

const requestIdleCallbackFn =
  typeof requestIdleCallback === "function" ? requestIdleCallback : setTimeout;
export function requestIdleCallback(callback: () => void): void {
  requestIdleCallbackFn(callback);
}
