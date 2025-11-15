import { useSyncRef } from "./useSyncRef";

/**
 * Hook that returns a stable callback reference that always calls the latest version of the callback.
 * Useful for avoiding unnecessary re-renders when passing callbacks to child components.
 *
 * @param cb - The callback function to wrap
 * @returns A stable callback reference
 */
export function useEvent<T extends (...args: any[]) => any>(cb: T): T {
  const cbRef = useSyncRef(cb);
  return ((...args: Parameters<T>) => cbRef.current(...args)) as T;
}
