/** @file A DialogTrigger opens a dialog when a trigger element is pressed. */
import * as React from "react";

import * as aria from "@/components/aria";

import { useEvent } from "@/hooks/useEvent";
import { useOverlayTriggerState } from "react-stately";
import { DialogPrerenderProvider } from "./DialogProvider";

/** Props passed to the render function of a {@link DialogTrigger}. */
export interface DialogTriggerRenderProps {
  readonly isOpen: boolean;
  readonly close: () => void;
  readonly open: () => void;
}
/** Props for a {@link DialogTrigger}. */
export interface DialogTriggerProps extends Omit<aria.DialogTriggerProps, "children"> {
  /** The trigger element. */
  readonly children: [
    React.ReactElement | ((props: DialogTriggerRenderProps) => React.ReactElement),
    React.ReactElement | ((props: DialogTriggerRenderProps) => React.ReactElement),
  ];
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
}

/** A DialogTrigger opens a dialog when a trigger element is pressed. */
export function DialogTrigger(props: DialogTriggerProps) {
  const { children, onOpenChange, onOpen = () => {}, onClose = () => {} } = props;

  const state = useOverlayTriggerState(props);

  const onOpenStableCallback = useEvent(onOpen);
  const onCloseStableCallback = useEvent(onClose);

  const onOpenChangeInternal = useEvent((opened: boolean) => {
    if (!opened) {
      onCloseStableCallback();
    } else {
      onOpenStableCallback();
    }

    state.setOpen(opened);
    onOpenChange?.(opened);
  });

  React.useEffect(() => {
    if (state.isOpen) {
      onOpenStableCallback();
    }
  }, [state.isOpen, onOpenStableCallback]);

  const [trigger, dialog] = children;

  const renderProps = {
    isOpen: state.isOpen,
    close: state.close.bind(state),
    open: state.open.bind(state),
  } satisfies DialogTriggerRenderProps;

  return (
    <aria.DialogTrigger {...state} onOpenChange={onOpenChangeInternal}>
      <DialogPrerenderProvider>
        {typeof trigger === "function" ? trigger(renderProps) : trigger}

        {typeof dialog === "function" ? dialog(renderProps) : dialog}
      </DialogPrerenderProvider>
    </aria.DialogTrigger>
  );
}
