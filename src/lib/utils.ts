import { LRUCache } from "./LRUCache";

export function noop(..._args: any[]): void {}
export async function noopAsync(..._args: any[]): Promise<void> {}

export function generateScopeId(): string {
  return `${Math.random().toString(36)}-${Date.now().toString(36)}`;
}

export interface Batch {
  (callback: () => void): void;
}

export function createBatcher(): Batch {
  let isPending = false;
  let cbToExecute: () => void = noop;

  return (callback: () => void) => {
    if (!isPending) {
      cbToExecute = callback;
      isPending = true;

      queueMicrotask(() => {
        try {
          cbToExecute();
        } catch (error) {
          console.error(error);
        } finally {
          isPending = false;
          cbToExecute = noop;
        }
      });
    }
  };
}

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
  return Math.min(base * Math.pow(2, attempts - 1), max);
}

function createKeySerializer() {
  const cache = new LRUCache<Array<unknown>, string>(100);

  return function stableKeySerialize(key: Array<unknown>): string {
    const cachedKey = cache.get(key);

    if (cachedKey) {
      return cachedKey;
    }

    const serializedKey = JSON.stringify(key);
    cache.set(key, serializedKey);
    return serializedKey;
  };
}

export const stableKeySerialize = createKeySerializer();

export interface MeasureDetail {
  track?: string;
  trackGroup?: string;
  properties?: Array<[string, string]>;
  color?: string;
}

export function createMeasurer(defaultDetail: Partial<MeasureDetail>) {
  function withMeasure<FN extends (...args: any[]) => any>(
    callback: FN,
    { name, detail }: { name: string; detail: MeasureDetail }
  ) {
    const mergedDetail = deepMerge<Partial<MeasureDetail>>(
      defaultDetail,
      detail
    );

    return (...args: Parameters<FN>): ReturnType<FN> => {
      const start = performance.now();
      const result = callback(...args);

      if (result instanceof Promise) {
        result.finally(() => {
          const end = performance.now();
          performance.measure(name, {
            start,
            end,
            detail: { devtools: mergedDetail },
          });
        });
      } else {
        const end = performance.now();
        performance.measure(name, {
          start,
          end,
          detail: { devtools: mergedDetail },
        });
      }

      return result;
    };
  }

  return withMeasure;
}

export function deepMerge<T extends Record<string, unknown>>(a: T, b: T): T {
  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return b;
  }

  const result = { ...a };
  for (const key in b) {
    // @ts-expect-error - we know that result[key] is a Record<string, unknown>
    result[key] = deepMerge<T>(result[key], b[key]);
  }
  return result;
}
