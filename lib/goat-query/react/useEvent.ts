import { useCallback, useRef } from "react";

const emptyArray: Readonly<never[]> = [];

export function useEvent<T extends (...args: any[]) => any>(cb: T): T {
  const ref = useRef<T>(cb);
  if (ref.current !== cb) {
    ref.current = cb;
  }
  return useCallback((...args: Parameters<T>) => ref.current(...args), emptyArray) as T;
}
