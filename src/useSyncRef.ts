import { useRef } from "react";

export function useSyncRef<V>(v: V) {
  const ref = useRef(v);

  if (ref.current !== v) {
    ref.current = v;
  }

  return ref;
}
