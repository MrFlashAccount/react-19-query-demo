"use client";
/**
 * @file A dialog is an overlay shown above other content in an application.
 * Can be used to display alerts, confirmations, or other content.
 */
import * as React from "react";

import { X } from "lucide-react";
import * as aria from "@/components/aria";
import * as ariaComponents from "@/components/AriaComponents";
import * as errorBoundary from "@/components/ErrorBoundary";
import * as portal from "@/components/Portal";
import * as suspense from "@/components/Suspense";

import * as mergeRefs from "@/utilities/mergeRefs";

import { ResetButtonGroupContext } from "@/components/AriaComponents";
import { useEvent } from "@/hooks/useEvent";
import type { VariantProps } from "@/utilities/tailwindVariants";
import { tv } from "@/utilities/tailwindVariants";
import { unsafeWriteValue } from "@/utilities/write";
import { Close } from "./Close";
import * as dialogProvider from "./DialogProvider";
import * as dialogStackProvider from "./DialogStackProvider";
import { DialogTrigger } from "./DialogTrigger";
import type * as types from "./types";
import * as utlities from "./utilities";
import { DIALOG_BACKGROUND } from "./variants";

const OVERLAY_STYLES = tv({
  base: "fixed inset-0 isolate flex items-center justify-center bg-primary/20",
  variants: {
    isEntering: { true: "animate-in fade-in duration-200 ease-out" },
    isExiting: { true: "animate-out fade-out duration-200 ease-in" },
    blockInteractions: {
      true: "backdrop-blur-md transition-[backdrop-filter] duration-200",
    },
  },
});

const MODAL_STYLES = tv({
  base: "fixed flex items-center justify-center text-xs text-primary",
  variants: {
    isEntering: { true: "animate-in ease-out duration-200" },
    isExiting: { true: "animate-out ease-in duration-200" },
    type: {
      modal: "inset-0",
      fullscreen: "inset-0",
      sheet: "top-0 right-0 bottom-0",
    },
  },
  compoundVariants: [
    { type: "modal", isEntering: true, class: "slide-in-from-top-1" },
    { type: "modal", isExiting: true, class: "slide-out-to-top-1" },
    { type: "fullscreen", isEntering: true, class: "zoom-in-[1.015]" },
    { type: "fullscreen", isExiting: true, class: "zoom-out-[1.015]" },
    {
      type: "sheet",
      isEntering: true,
      class: "slide-in-from-bottom-1 md:slide-in-from-right-1",
    },
    {
      type: "sheet",
      isExiting: true,
      class: "slide-out-to-bottom-1 md:slide-out-to-right-1",
    },
  ],
});

const DIALOG_STYLES = tv({
  base: DIALOG_BACKGROUND({
    className: "w-full max-w-full flex flex-col text-left align-middle shadow-xl overflow-clip",
  }),
  variants: {
    type: {
      modal: {
        base: "w-full min-h-[100px] max-h-[90vh]",
        header: "px-3.5 pt-[3px] pb-0.5 min-h-[42px]",
      },
      fullscreen: {
        base: "w-full h-full max-w-full max-h-full bg-clip-border",
        header: "px-4 pt-[5px] pb-1.5 min-h-12",
      },
      sheet: {
        base: "min-w-[320px] md:min-w-[600px] md:max-w-[90dvw] md:h-full max-w-full max-h-full bg-clip-border",
        header: "px-4 pt-[5px] pb-1.5 min-h-12",
      },
    },
    fitContent: {
      true: {
        base: "min-w-max",
        content: "min-w-max",
      },
    },
    hideCloseButton: { true: { closeButton: "hidden" } },
    closeButton: {
      normal: { base: "", closeButton: "" },
      floating: {
        base: "",
        closeButton:
          "absolute left-4 top-4 visible z-1 transition-[opacity,transform] duration-150",
        header: "p-0 max-h-0 min-h-0 h-0 border-0 z-1",
        content: "isolate",
      },
      none: {},
    },
    rounded: {
      none: { base: "" },
      small: { base: "rounded-sm" },
      medium: { base: "rounded-md" },
      large: { base: "rounded-lg" },
      xlarge: { base: "rounded-xl" },
      xxlarge: { base: "rounded-2xl", scroller: "scroll-offset-edge-2xl" },
      xxxlarge: { base: "rounded-3xl", scroller: "scroll-offset-edge-3xl" },
      xxxxlarge: { base: "rounded-4xl", scroller: "scroll-offset-edge-4xl" },
    },
    /**
     * The size of the dialog.
     * Only applies to the `modal` type.
     */
    size: {
      small: { base: "" },
      medium: { base: "" },
      large: { base: "" },
      xlarge: { base: "" },
      xxlarge: { base: "" },
      xxxlarge: { base: "" },
      xxxxlarge: { base: "" },
    },
    padding: {
      none: { content: "p-0" },
      small: { content: "px-1 pt-3.5 pb-3.5" },
      medium: { content: "px-4 pt-3 pb-4" },
      large: { content: "px-8 pt-5 pb-5" },
      xlarge: { content: "p-12 pt-6 pb-8" },
      xxlarge: { content: "p-16 pt-8 pb-12" },
      xxxlarge: { content: "p-20 pt-10 pb-16" },
    },
    scrolledToTop: { true: { header: "border-transparent" } },
    layout: {
      true: { measurerWrapper: "h-auto" },
      false: { measurerWrapper: "h-full" },
    },
  },
  slots: {
    header:
      "sticky z-1 top-0 grid grid-cols-[1fr_auto_1fr] items-center border-b-0.5 border-primary/10 transition-[border-color] duration-150",
    closeButton: "col-start-1 col-end-1 mr-auto",
    heading: "col-start-2 col-end-2 my-0 text-center",
    scroller: "flex flex-col h-full overflow-y-auto max-h-[inherit]",
    measurerWrapper: "inline-grid min-h-fit w-full grid-rows-1",
    content: "inline-block max-h-fit min-h-fit [grid-area:1/1] min-w-0",
  },
  compoundVariants: [
    { type: "modal", size: "small", class: "max-w-sm" },
    { type: "modal", size: "medium", class: "max-w-md" },
    { type: "modal", size: "large", class: "max-w-lg" },
    { type: "modal", size: "xlarge", class: "max-w-xl" },
    { type: "modal", size: "xxlarge", class: "max-w-2xl" },
    { type: "modal", size: "xxxlarge", class: "max-w-3xl" },
    { type: "modal", size: "xxxxlarge", class: "max-w-4xl" },
    { type: "sheet", size: "small", class: "max-w-sm" },
    { type: "sheet", size: "medium", class: "max-w-md" },
    { type: "sheet", size: "large", class: "max-w-lg" },
    { type: "sheet", size: "xlarge", class: "max-w-xl" },
    { type: "sheet", size: "xxlarge", class: "max-w-2xl" },
    { type: "sheet", size: "xxxlarge", class: "max-w-3xl" },
    { type: "sheet", size: "xxxxlarge", class: "max-w-4xl" },
    { type: "sheet", rounded: "none", class: "rounded-none" },
    {
      type: "sheet",
      rounded: "small",
      class: "rounded-l-sm rounded-r-none",
    },
    { type: "sheet", rounded: "medium", class: "rounded-l-md rounded-r-none" },
    { type: "sheet", rounded: "large", class: "rounded-l-lg rounded-r-none" },
    { type: "sheet", rounded: "xlarge", class: "rounded-l-xl rounded-r-none" },
    {
      type: "sheet",
      rounded: "xxlarge",
      class: "rounded-l-2xl rounded-r-none",
    },
    {
      type: "sheet",
      rounded: "xxxlarge",
      class: "rounded-l-3xl rounded-r-none",
    },
    {
      type: "sheet",
      rounded: "xxxxlarge",
      class: "rounded-l-4xl rounded-r-none",
    },
    { type: "fullscreen", class: { measurerWrapper: "h-full" } },
  ],
  defaultVariants: {
    layout: true,
    type: "modal",
    closeButton: "normal",
    hideCloseButton: false,
    size: "medium",
    padding: "none",
    rounded: "xxxlarge",
  },
});

/** Props for the {@link Dialog} component. */
export interface DialogProps
  extends types.DialogProps, Omit<VariantProps<typeof DIALOG_STYLES>, "scrolledToTop"> {}

/**
 * A dialog is an overlay shown above other content in an application.
 * Can be used to display alerts, confirmations, or other content.
 */
export function Dialog(props: DialogProps) {
  const {
    type = "modal",
    isDismissable = true,
    isKeyboardDismissDisabled = false,
    // onOpenChange = () => {},
    modalProps = {},
  } = props;

  const root = portal.useStrictPortalContext();

  return (
    <aria.ModalOverlay
      className={({ isEntering, isExiting }) =>
        OVERLAY_STYLES({
          isEntering,
          isExiting,
          blockInteractions: !isDismissable,
        })
      }
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      UNSTABLE_portalContainer={root}
      // onOpenChange={onOpenChange}
      shouldCloseOnInteractOutside={() => false}
      {...modalProps}
    >
      {(values) => (
        <aria.Modal
          className={({ isEntering, isExiting }) => MODAL_STYLES({ type, isEntering, isExiting })}
          isDismissable={isDismissable}
          isKeyboardDismissDisabled={isKeyboardDismissDisabled}
          UNSTABLE_portalContainer={root}
          // onOpenChange={onOpenChange}
          shouldCloseOnInteractOutside={() => false}
          {...modalProps}
        >
          <DialogContent {...props} modalState={values.state} />
        </aria.Modal>
      )}
    </aria.ModalOverlay>
  );
}

const TYPE_TO_DIALOG_TYPE: Record<
  NonNullable<DialogProps["type"]>,
  dialogStackProvider.DialogStackItem["type"]
> = {
  modal: "dialog",
  fullscreen: "dialog-fullscreen",
  sheet: "dialog",
};

/**
 * Props for the {@link DialogContent} component.
 */
interface DialogContentProps extends DialogProps, VariantProps<typeof DIALOG_STYLES> {
  readonly modalState: aria.OverlayTriggerState;
}

/**
 * The content of a dialog.
 * @internal
 */
function DialogContent(props: DialogContentProps) {
  const {
    variants = DIALOG_STYLES,
    modalState,
    className,
    type = "modal",
    rounded,
    hideCloseButton = false,
    closeButton = "normal",
    size,
    padding: paddingRaw,
    fitContent,
    layout,
    testId = "dialog",
    title,
    children,
    isDismissable = true,
    onDismiss,
    ...ariaDialogProps
  } = props;

  const dialogRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const dialogId = aria.useId();

  const titleId = `${dialogId}-title`;
  const padding = paddingRaw ?? (type === "modal" ? "medium" : "xlarge");
  const isFullscreen = type === "fullscreen";
  const isSheet = type === "sheet";

  // Mutating the method of the modalState object to ensure that the close `close`
  // function will call the `onDismiss` function and then close the modal.
  unsafeWriteValue(
    modalState,
    "close",
    useEvent(() => {
      onDismiss?.();
      modalState.setOpen(false);
    }),
  );

  const close = useEvent(() => {
    modalState.close();
  });

  utlities.useInteractOutside({
    ref: dialogRef,
    id: dialogId,
    onInteractOutside: () => {
      if (isDismissable) {
        close();
      } else {
        if (dialogRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-magic-numbers
          utlities.animateScale(dialogRef.current, 1.02);
        }
      }
    },
  });

  const styles = variants({
    className,
    type,
    rounded,
    hideCloseButton,
    closeButton,
    size,
    padding,
    fitContent,
    layout,
  });

  return (
    <ResetButtonGroupContext>
      <dialogProvider.DialogProvider close={close} dialogId={dialogId}>
        <aria.Dialog
          id={dialogId}
          ref={(ref: HTMLDivElement | null) => {
            mergeRefs.mergeRefs(dialogRef, (element) => {
              if (element) {
                // This is a workaround for the `data-testid` attribute not being
                // supported by the 'react-aria-components' library.
                // We need to set the `data-testid` attribute on the dialog element
                // so that we can use it in our tests.
                // This is a temporary solution until we refactor the Dialog component
                // to use `useDialog` hook from the 'react-aria-components' library.
                // this will allow us to set the `data-testid` attribute on the dialog
                element.dataset.testid = testId;
              }
            })(ref);
          }}
          className={styles.base()}
          aria-labelledby={titleId}
          {...ariaDialogProps}
        >
          <DialogHeader
            scrollerRef={scrollerRef}
            closeButton={closeButton}
            title={title}
            titleId={titleId}
            fitContent={fitContent}
            hideCloseButton={hideCloseButton}
            padding={padding}
            rounded={rounded}
            size={size}
            type={type}
            variants={variants}
          />

          <DialogBody
            dialogId={dialogId}
            scrollerRef={scrollerRef}
            measurerWrapperClassName={styles.measurerWrapper()}
            contentClassName={styles.content()}
            type={type}
          >
            {children}
          </DialogBody>
        </aria.Dialog>

        <dialogStackProvider.DialogStackRegistrar id={dialogId} type={TYPE_TO_DIALOG_TYPE[type]} />
      </dialogProvider.DialogProvider>
    </ResetButtonGroupContext>
  );
}

/**
 * Props for the {@link DialogBody} component.
 */
interface DialogBodyProps {
  readonly scrollerRef: React.RefObject<HTMLDivElement | null>;
  readonly dialogId: string;
  readonly measurerWrapperClassName: string;
  readonly contentClassName: string;
  readonly children: DialogProps["children"];
  readonly type: DialogProps["type"];
}

/**
 * The internals of a dialog. Exists only as a performance optimization.
 */

const DialogBody = React.memo(function DialogBody(props: DialogBodyProps) {
  const { scrollerRef, children, contentClassName, type } = props;
  const { close } = dialogProvider.useDialogStrictContext();

  return (
    <div ref={scrollerRef} className={contentClassName}>
      <errorBoundary.ErrorBoundary>
        <suspense.Suspense loaderProps={{ minHeight: type === "fullscreen" ? "full" : "h32" }}>
          {typeof children === "function" ? children({ close }) : children}
        </suspense.Suspense>
      </errorBoundary.ErrorBoundary>
    </div>
  );
});

/**
 * Props for the {@link DialogHeader} component.
 */
interface DialogHeaderProps extends Omit<VariantProps<typeof DIALOG_STYLES>, "scrolledToTop"> {
  readonly scrollerRef: React.RefObject<HTMLDivElement | null>;
  readonly closeButton: DialogProps["closeButton"];
  readonly title: DialogProps["title"];
  readonly titleId: string;
}

/**
 * The header of a dialog.
 * @internal
 */
const DialogHeader = React.memo(function DialogHeader(props: DialogHeaderProps) {
  const {
    closeButton,
    title,
    titleId,
    scrollerRef,
    fitContent,
    hideCloseButton,
    padding,
    rounded,
    size,
    type,
    variants = DIALOG_STYLES,
    layout,
  } = props;

  const styles = variants({
    type,
    closeButton,
    fitContent,
    hideCloseButton,
    padding,
    rounded,
    size,
    layout,
  });

  const [isScrolledToTop, privateSetIsScrolledToTop] = React.useState(true);

  const setIsScrolledToTop = (value: boolean) => {
    privateSetIsScrolledToTop(value);
  };

  /** Handles the scroll event on the dialog content. */
  const handleScrollEvent = useEvent(() => {
    if (scrollerRef.current) {
      setIsScrolledToTop(scrollerRef.current.scrollTop === 0);
    } else {
      setIsScrolledToTop(true);
    }
  });

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) {
      handleScrollEvent();

      scroller.addEventListener("scroll", handleScrollEvent, { passive: true });

      return () => {
        scroller.removeEventListener("scroll", handleScrollEvent);
      };
    }
  }, [handleScrollEvent, scrollerRef]);

  return (
    <aria.Header className={styles.header({ scrolledToTop: isScrolledToTop })}>
      {closeButton !== "none" && (
        <Dialog.Close variant="icon" size="xsmall" className={styles.closeButton()} icon={<X />} />
      )}

      {title != null && (
        <ariaComponents.Text.Heading
          id={titleId}
          level={2}
          className={styles.heading()}
          weight="semibold"
        >
          {title}
        </ariaComponents.Text.Heading>
      )}
    </aria.Header>
  );
});

Dialog.Close = Close;
Dialog.Trigger = DialogTrigger;
