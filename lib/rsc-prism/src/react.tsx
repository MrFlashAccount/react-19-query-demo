import { createContext, use, useEffect, useState } from "react";
import { fetchRSC } from "./client";
import type { RSCTransport } from "./transport";
import type { ComponentReference } from "./types";

const $$invalidations = new Set<() => void>();
export function invalidateRSC() {
  for (const invalidation of $$invalidations) {
    invalidation();
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

export type RSCLoaderProps<Props = unknown> = Props & {
  /**
   * A key that will be used to invalidate the RSC component.
   */
  $refreshKey?: any;
};

export function rsc<Props = unknown>(reference: ComponentReference<Props>) {
  let __cacheKey: string | undefined;
  let __cachePromise: Promise<React.ReactNode> | undefined;

  return function RSCLoader(props: RSCLoaderProps<Props>) {
    const transport = use(RSCTransportContext);
    const key = JSON.stringify(props);
    const [, $$refresh] = useState({});

    useEffect(() => {
      const invalidate = () => {
        __cachePromise = undefined;
        __cacheKey = undefined;
        return $$refresh({});
      };
      $$invalidations.add(invalidate);
      return () => {
        $$invalidations.delete(invalidate);
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
