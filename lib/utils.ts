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
