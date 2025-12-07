export function noop(..._args: any[]): void {}
export async function noopAsync(..._args: any[]): Promise<void> {}

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
