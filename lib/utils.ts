import { brand, isBrand } from "./types";

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
export type SerializedParams = brand.infer<typeof SerializedParams>;

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

const SERIALIZED_PARAMS_SYMBOL = Symbol("serializedParams");

export const WithSerializedParams = brand.generic<"WithSerializedParams">();
export type WithSerializedParams<TParams> = brand.Generic<
  "WithSerializedParams",
  TParams
>;

export function params<const TParams>(
  params: TParams
): WithSerializedParams<TParams> {
  if (isBrand(WithSerializedParams, params)) {
    return params;
  }

  Object.defineProperty(params, SERIALIZED_PARAMS_SYMBOL, {
    value: serializeParams(params),
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return WithSerializedParams(params);
}

export function getSerializedParams<TParams>(
  params: WithSerializedParams<TParams>
): SerializedParams {
  if (SERIALIZED_PARAMS_SYMBOL in params) {
    return (params as any)[SERIALIZED_PARAMS_SYMBOL];
  }

  // This should never happen
  throw new Error("Serialized params not found");
}
