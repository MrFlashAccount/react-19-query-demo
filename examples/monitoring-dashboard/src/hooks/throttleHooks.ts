/**
 * @file
 * Throttle hooks.
 */

import { useEvent } from "./useEvent";

import { useRAF } from "./useRaf";

/**
 * Synchronizes calbacks with the RAF loop.
 * Cancels all callbacks before scheduling a new one.
 */
export function useRafThrottle() {
  const { cancelRAF, scheduleRAF: scheduleRAFRaw } = useRAF();

  const scheduleRAF = useEvent((callback: FrameRequestCallback) => {
    cancelRAF();
    scheduleRAFRaw(callback);
  });

  return { scheduleRAF, cancelRAF };
}
