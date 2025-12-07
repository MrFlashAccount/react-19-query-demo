import { noop } from "./utils";

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
