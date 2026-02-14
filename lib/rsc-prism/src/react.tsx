import { createContext, use, useEffect, useState } from "react";
import { fetchRSC } from "./client";
import type { RSCTransport } from "./transport";

const $$invalidations = new Set<WeakRef<() => void>>();
export function invalidateRSC() {
  for (const invalidation of $$invalidations) {
    invalidation.deref()?.();
  }
}

const RSCTransportContext = createContext<RSCTransport | null>(null);

export function RSCTransportProvider({
  transport,
  children,
}: {
  transport: RSCTransport;
  children: React.ReactNode;
}) {
  return <RSCTransportContext.Provider value={transport}>{children}</RSCTransportContext.Provider>;
}

export function rsc<Props = unknown>(
  reference: (props: Props) => React.JSX.Element | null | React.JSX.Element[],
) {
  let __cacheKey: string | undefined;
  let __cachePromise: Promise<React.ReactNode> | undefined;

  return function RSCLoader(props: Props) {
    const transport = use(RSCTransportContext);
    const key = JSON.stringify(props);
    const [, $$refresh] = useState({});

    useEffect(() => {
      const ref = new WeakRef(() => {
        __cachePromise = undefined;
        __cacheKey = undefined;
        return $$refresh({});
      });
      $$invalidations.add(ref);
      return () => {
        $$invalidations.delete(ref);
      };
    }, []);
    if (__cacheKey === key) {
      return __cachePromise;
    }
    __cacheKey = key;
    __cachePromise = fetchRSC(reference, { props, transport });
    return __cachePromise;
  };
}
