/** @file A wrapper containing all UI-related React Provdiers. */
import * as React from "react";

import { DialogStackProvider } from "@/components/AriaComponents";
import { PortalProvider } from "@/components/Portal";
import { I18nProvider } from "react-aria-components";

/**
 * A context containing the root elements for the application.
 */
interface RootContextType {
  readonly portalRoot: HTMLElement;
  readonly appRoot: HTMLElement;
}

const RootContext = React.createContext<RootContextType>({
  portalRoot: document.body,
  appRoot: document.body,
});

/** Props for a {@link UIProviders}. */
export interface UIProvidersProps extends Readonly<React.PropsWithChildren> {
  readonly portalRoot: HTMLElement;
  readonly appRoot: HTMLElement;
  readonly locale: string;
}

/** A wrapper containing all UI-related React Provdiers. */
export default function UIProviders(props: UIProvidersProps) {
  const { portalRoot, appRoot, locale, children } = props;

  return (
    <RootContext.Provider value={{ portalRoot, appRoot }}>
      <PortalProvider value={portalRoot}>
        <DialogStackProvider>
          <I18nProvider locale={locale}>{children}</I18nProvider>
        </DialogStackProvider>
      </PortalProvider>
    </RootContext.Provider>
  );
}

/**
 * A hook to get the root elements for the application.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useRootContext() {
  return React.useContext(RootContext);
}
