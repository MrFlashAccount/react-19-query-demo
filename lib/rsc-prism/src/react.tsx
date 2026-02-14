import { createContext, use } from "react";
import { fetchRSC } from "./client";
import type { RSCTransport } from "./transport";

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
  let __cacheKey: string;
  let __cachePromise: Promise<React.ReactNode>;

  return function RSCLoader(props: Props) {
    const transport = use(RSCTransportContext);
    const key = JSON.stringify(props);
    if (__cacheKey === key) {
      return __cachePromise;
    }
    __cacheKey = key;
    __cachePromise = fetchRSC(reference, { props, transport });
    return __cachePromise;
  };
}
