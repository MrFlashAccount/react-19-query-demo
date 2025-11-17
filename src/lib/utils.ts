export function noop(): void {}
export async function noopAsync(): Promise<void> {}

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
