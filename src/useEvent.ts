import { useCallback } from "react";
import * as React from "react";
import { useLatest } from "./useLatest";

const emptyArray: Readonly<never[]> = [];
const noop = () => {};
const useEffectEvent = React.useEffectEvent ?? useCallback;

/**
 * Hook that returns a stable callback reference that always calls the latest version of the callback.
 * Useful for avoiding unnecessary re-renders when passing callbacks to child components.
 *
 * @param cb - The callback function to wrap
 * @returns A stable callback reference
 */
// This hook violates the rules of react thus can't be memoized by react compiler.
// But it's fine: the hook is memoized manually and safe to use
export function useEvent<T extends (...args: any[]) => any>(cb: T): T {
  const cbRef = useLatest(cb);
  const dontCallInRenderGuard = useEffectEvent(noop);
  return useCallback((...args: Parameters<T>) => {
    // useEventHook shall never be called during the render phase.
    // Because otherwise it violates the rules of react, especially the idempotency rule.
    if (import.meta.env.DEV) {
      dontCallInRenderGuard();
    }
    return cbRef.current(...args);
  }, emptyArray) as T;
}
