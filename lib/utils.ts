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
