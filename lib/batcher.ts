import { noop } from "./utils";

export interface Batch {
  (callback: () => void): void;
}

export interface BatchOptions {
  batchMethod?: (callback: () => void) => void;
}

export function createBatcher(options: BatchOptions = {}): Batch {
  const { batchMethod = queueMicrotask } = options;
  let isPending = false;
  let cbToExecute: () => void = noop;

  return function batch(callback: () => void) {
    if (!isPending) {
      cbToExecute = callback;
      isPending = true;

      batchMethod(() => {
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
