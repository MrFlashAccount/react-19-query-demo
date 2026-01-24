import { useCallback } from "react";
import * as React from "react";
import { noop, noopcb } from "../utils";
import { useLatest } from "./useLatest";

const emptyArray: Readonly<never[]> = [];
const useEffectEvent = "useEffectEvent" in React ? React.useEffectEvent : noopcb;

export function useEvent<T extends (...args: any[]) => any>(cb: T | undefined | null | false): T {
  const ref = useLatest<T | undefined | null | false>(cb);
  const dontCallInRenderGuard = useEffectEvent(noop);
  // @ts-expect-error we know that the ref.current is of type T
  return useCallback<T>((...args: Parameters<T>) => {
    dontCallInRenderGuard();

    if (ref.current === null || ref.current === false || ref.current === undefined) {
      return;
    }

    return ref.current(...args);
  }, emptyArray);
}
