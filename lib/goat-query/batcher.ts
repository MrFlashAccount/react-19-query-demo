import { noop } from "./utils";

export interface OncePerTick {
  (callback: () => void): void;
}

export interface OncePerTickOptions {
  /**
   * Scheduling primitive used to flush the callback.
   * Defaults to `queueMicrotask` (i.e. within the same tick).
   */
  tickMethod?: (callback: () => void) => void;
}

/**
 * Creates a function that executes a given callback once per tick,
 * if multiple calls are made within the same tick,
 * only the first call will be executed and the others will be ignored.
 * @param options - The options for the once per tick function.
 * @returns A function that executes a given callback once per tick.
 */
export function createOncePerTick(
  options: OncePerTickOptions = {}
): OncePerTick {
  const { tickMethod = queueMicrotask } = options;

  let isPending = false;
  let cbToExecute: () => void = noop;

  /**
   * Executes a given callback once per tick,
   * if multiple calls are made within the same tick,
   * only the first call will be executed and the others will be ignored.
   * @param callback - The callback to execute.
   */
  return function oncePerTick(callback: () => void) {
    if (isPending) {
      return;
    }

    cbToExecute = callback;
    isPending = true;

    tickMethod(() => {
      try {
        cbToExecute();
      } catch (error) {
        console.error(error);
      } finally {
        isPending = false;
      }
    });
  };
}
