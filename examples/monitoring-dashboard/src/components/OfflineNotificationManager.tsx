/**
 * @file
 *
 * Offline Notification Manager component.
 *
 * This component is responsible for displaying a toast notification when the user goes offline or online.
 */

import * as React from "react";

import * as offlineHooks from "#/hooks/offlineHooks";

/** Props for {@link OfflineNotificationManager} */
export type OfflineNotificationManagerProps = Readonly<React.PropsWithChildren>;

/** Context props for {@link OfflineNotificationManager} */
interface OfflineNotificationManagerContextProps {
  readonly isNested: boolean;
}

const OfflineNotificationManagerContext =
  React.createContext<OfflineNotificationManagerContextProps>({ isNested: false });

/** Offline Notification Manager component. */
export function OfflineNotificationManager(props: OfflineNotificationManagerProps) {
  const { children } = props;
  const parent = React.useContext(OfflineNotificationManagerContext);
  if (parent.isNested) {
    return <>{children}</>;
  }

  const [message, setMessage] = React.useState<string | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  const hideTimeoutRef = React.useRef<number | null>(null);

  offlineHooks.useOfflineChange(
    (isOffline) => {
      if (hideTimeoutRef.current != null) {
        window.clearTimeout(hideTimeoutRef.current);
      }

      setMessage(isOffline ? "You are offline" : "You are back online");
      setIsVisible(true);
      hideTimeoutRef.current = window.setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    },
    { triggerImmediate: false },
  );

  return (
    <OfflineNotificationManagerContext.Provider value={{ isNested: true }}>
      {children}
      {isVisible && message != null && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2">
          <div className="pointer-events-auto rounded-xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 shadow-lg backdrop-blur">
            {message}
          </div>
        </div>
      )}
    </OfflineNotificationManagerContext.Provider>
  );
}
