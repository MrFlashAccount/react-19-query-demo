/**
 * @file
 *
 * The context value for a dialog.
 */
import * as React from "react";
import { useEvent } from "@/hooks/useEvent";
import { createContext } from "../../../utilities/react";

/** The context value for a dialog. */
export interface DialogContextValue {
  readonly close: () => void;
  readonly dialogId: string;
}

/** The context for a dialog. */
const [DialogContext, useDialogStrictContext, useDialogContext] =
  createContext<DialogContextValue | null>(null, "DialogContext");

/** The provider for a dialog. */
export function DialogProvider(
  props: DialogContextValue & React.PropsWithChildren,
) {
  const { children, close, dialogId } = props;

  const value = React.useMemo(() => ({ close, dialogId }), [close, dialogId]);

  return (
    <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
  );
}

const [DialogPrerenderContext, , useDialogPrerenderContext] = createContext(
  {
    prerenderEnabled: false,
    enablePrerender: () => {},
    disablePrerender: () => {},
  },
  "DialogPrerenderContext",
);

export function DialogPrerenderProvider(props: React.PropsWithChildren) {
  const { children } = props;
  const [prerenderEnabled, setPrerenderEnabled] = React.useState(false);

  const value = {
    prerenderEnabled,
    enablePrerender: useEvent(() => setPrerenderEnabled(true)),
    disablePrerender: useEvent(() => setPrerenderEnabled(false)),
  };

  return (
    <DialogPrerenderContext.Provider value={value}>
      {children}
    </DialogPrerenderContext.Provider>
  );
}

export { useDialogContext, useDialogStrictContext, useDialogPrerenderContext };
