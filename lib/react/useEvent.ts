import { useSyncRef } from "./useSyncRef";

export function useEvent<T extends (...args: any[]) => any>(cb: T): T {
  const cbRef = useSyncRef(cb);
  return ((...args: Parameters<T>) => cbRef.current(...args)) as T;
}
