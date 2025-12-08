import { useCallback, useRef, type RefObject } from "react";

function useSyncRef<T>(value: T): RefObject<T> {
  const ref = useRef<T>(value);
  if (ref.current !== value) {
    ref.current = value;
  }
  return ref;
}

const emptyArray: Readonly<never[]> = [];

export function useEvent<T extends (...args: any[]) => any>(cb: T): T {
  const ref = useSyncRef(cb);
  return useCallback(
    (...args: Parameters<T>) => ref.current(...args),
    emptyArray
  ) as T;
}
