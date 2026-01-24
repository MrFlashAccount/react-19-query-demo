/** @file `useEvent` shim. */
import { useCallback, useEffectEvent } from "react";

import { useLatest } from "./useLatest";

const noop = () => {};
const EMPTY_ARRAY: never[] = [];

/**
 * `useEvent` shim.
 * @see https://github.com/reactjs/rfcs/pull/220
 * @see https://github.com/reactjs/rfcs/blob/useevent/text/0000-useevent.md#internal-implementation
 */
export function useEvent<Func extends (...args: never[]) => unknown>(
  callback: Func | false | null | undefined,
) {
  "use no memo";
  const callbackRef = useLatest(callback);
  const dontCallInRenderGuard = useEffectEvent(noop);

  // Make sure that the value of `this` provided for the call to fn is not `ref`
  // This type assertion is safe, because it's a transparent wrapper around the original callback

  return useCallback<Func>(
    // @ts-expect-error we know that the callbackRef.current is of type Func
    function eventCallback(...args: Parameters<Func>) {
      if (import.meta.env.DEV) {
        dontCallInRenderGuard();
      }

      if (typeof callbackRef.current === "function") {
        // eslint-disable-next-line no-restricted-syntax
        return callbackRef.current(...args) as ReturnType<Func>;
      }
    },
    EMPTY_ARRAY,
  );
}
