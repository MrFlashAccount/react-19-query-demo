import { useEffectEvent } from "react";

export function useEvent<T extends (...args: any[]) => any>(cb: T): T {
  return useEffectEvent(function effectEvent(...args: Parameters<T>) {
    return cb(...args);
  } as T);
}
