/**
 * @file
 *
 * Contains hooks that are called when the component mounts.
 */
import { useEffect, useRef } from "react";

import { useEvent } from "./useEvent";

/**
 * Executes the provided callback during the first render of the component.
 * Unlike `useEffect(() => {}, [])`, this hook executes the callback during the first render.
 */
export function useMount(callback: () => void) {
  const isFirstRender = useIsFirstRender();
  const stableCallback = useEvent(callback);

  if (isFirstRender()) {
    stableCallback();
  }
}

/**
 * Executes the provided callback once component is mounted.
 * Similar to `componentDidMount` in class components,
 * or `useLayoutEffect(() => {}, [])` with an empty dependency array.
 */
export function useMounted(callback: () => void) {
  const stableCallback = useEvent(callback);

  useEffect(() => {
    stableCallback();
    // stable callback never changes.
  }, [stableCallback]);
}

/** Returns a function that returns `true` if the component renders for the first time. */
export function useIsFirstRender() {
  // We use `null` here instead of `true` to make react-compiler happy
  // by utilizing a `lazy ref initialization` pattern.
  // see:https://github.com/facebook/react/pull/31188
  const isFirstMount = useRef<false | null>(null);
  const stableCallbackTrue = useEvent(() => true);
  const stableCallbackFalse = useEvent(() => false);

  if (isFirstMount.current == null) {
    isFirstMount.current = false;
    return stableCallbackTrue;
  } else {
    return stableCallbackFalse;
  }
}
