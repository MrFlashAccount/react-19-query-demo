/** @file */
import * as React from "react";

import * as eventCallback from "./useEvent";

/** Calls callback when component is unmounted. */
export function useUnmount(callback: () => void) {
  // by using `useEventCallback` we can ensure that the callback is stable
  const callbackEvent = eventCallback.useEvent(callback);

  React.useEffect(() => callbackEvent, [callbackEvent]);
}
