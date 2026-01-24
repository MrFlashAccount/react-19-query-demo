import { useCallback, useRef, type RefObject } from "react";
import * as React from "react";

const useEffectEvent =
  /* @__PURE__ */ React.useEffectEvent ??
  (React as any)["experimental_useEffectEvent"] ??
  useCallback;

function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef<T>(value);
  if (ref.current !== value) {
    ref.current = value;
  }
  return ref;
}

const emptyArray: Readonly<never[]> = [];
const noop = () => {};

export function useEvent<T extends (...args: any[]) => any>(cb: T): T {
  const cbRef = useLatest(cb);
  const dontCallInRenderGuard = useEffectEvent(noop);
  return useCallback((...args: Parameters<T>) => {
    if (import.meta.env.DEV) {
      dontCallInRenderGuard();
    }
    return cbRef.current(...args);
  }, emptyArray) as T;
}
