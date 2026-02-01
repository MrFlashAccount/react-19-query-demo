/** @file A hook for creating a visual tooltip that appears when the target element is hovered over. */
import * as aria from "@/components/aria";
import * as ariaComponents from "@/components/AriaComponents";
import * as eventCallback from "@/hooks/useEvent";
import * as React from "react";

/** Props for {@link useVisualTooltip}. */
export interface VisualTooltipOptions extends Pick<
  ariaComponents.TooltipProps,
  "maxWidth" | "rounded" | "size" | "variant"
> {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly targetRef: React.RefObject<HTMLElement>;
  readonly triggerRef?: React.RefObject<HTMLElement> | undefined;
  readonly isDisabled?: boolean;
  readonly overlayPositionProps?: Pick<
    aria.AriaPositionProps,
    "containerPadding" | "crossOffset" | "offset" | "placement"
  >;
  /**
   * Determines when the tooltip should be displayed.
   * - 'always': Tooltip is always displayed when the target element is hovered over.
   * - 'whenOverflowing': Tooltip is displayed only when the target element is overflowing.
   * - A function that returns a boolean. The function is called with the target element as an argument.
   */
  readonly display?: DisplayStrategy | ((target: HTMLElement) => boolean);
  readonly testId?: string;
}

/** The return value of the {@link useVisualTooltip} hook. */
export interface VisualTooltipReturn {
  readonly targetProps: aria.DOMAttributes<aria.FocusableElement> & { readonly id: string };
  readonly tooltip: React.JSX.Element | null;
}

/** The display strategy for the tooltip. */
type DisplayStrategy = "always" | "whenOverflowing";

const DEFAULT_DELAY = 250;

/**
 * Creates a tooltip that appears when the target element is hovered over.
 * Works with any element that has a ref.
 * doesn't have a11y support. It's a visual tooltip.
 * Common use case is to show a tooltip when the content of an element is overflowing,
 * Or show a description of the element when hovered over.
 */
export function useVisualTooltip(props: VisualTooltipOptions): VisualTooltipReturn {
  const {
    children,
    targetRef,
    className,
    isDisabled = false,
    overlayPositionProps = {},
    display = "always",
    testId = "visual-tooltip",
    rounded,
    variant,
    size,
    maxWidth,
  } = props;

  const [isTooltipDisabled, setIsTooltipDisabled] = React.useState(true);

  const id = React.useId();

  const disabled = isDisabled || isTooltipDisabled;

  const [state, setState] = React.useState({ isOpen: false });

  const open = eventCallback.useEvent(() => {
    setState((prev) => ({ ...prev, isOpen: true }));
  });
  const close = eventCallback.useEvent(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  });

  const handleHoverChange = eventCallback.useEvent((isHovered: boolean) => {
    if (disabled) {
      if (state.isOpen) {
        close();
      }
      return;
    }

    const shouldDisplay = () => {
      if (isHovered && targetRef.current != null) {
        return typeof display === "function"
          ? display(targetRef.current)
          : DISPLAY_STRATEGIES[display](targetRef.current);
      } else {
        return false;
      }
    };

    React.startTransition(() => {
      setIsTooltipDisabled(!shouldDisplay());

      if (shouldDisplay()) {
        open();
      } else {
        close();
      }
    });
  });

  const { hoverProps: targetHoverProps } = aria.useHover({
    isDisabled,
    onHoverChange: handleHoverChange,
  });

  return {
    targetProps: aria.mergeProps<React.HTMLAttributes<HTMLElement>>()(targetHoverProps, {
      id,
      style: { anchorName: `--${id}` },
    } as any),
    tooltip: state.isOpen ? (
      <TooltipInner
        id={id}
        overlayPositionProps={overlayPositionProps}
        className={className}
        variant={variant}
        rounded={rounded}
        size={size}
        maxWidth={maxWidth}
        children={children}
        testId={testId}
      />
    ) : null,
  } as const;
}

/** Props for {@link TooltipInner}. */
interface TooltipInnerProps extends Pick<
  ariaComponents.TooltipProps,
  "maxWidth" | "rounded" | "size" | "variant"
> {
  readonly id: string;
  readonly children: React.ReactNode;
  readonly className?: string | undefined;
  readonly testId?: string | undefined;
  readonly overlayPositionProps: Pick<
    aria.AriaPositionProps,
    "containerPadding" | "crossOffset" | "offset" | "placement"
  >;
}

const PLACEMENT_TO_POSITION_AREA: Record<string, string> = {
  bottom: "top",
  top: "bottom",
  left: "right",
  right: "left",
  "bottom-start": "top start",
  "bottom-end": "top end",
  "top-start": "bottom start",
  "top-end": "bottom end",
  "left-start": "right start",
  "left-end": "right end",
  "right-start": "left start",
  "right-end": "left end",
};

function getPositionArea(placement: string): string {
  return PLACEMENT_TO_POSITION_AREA[placement] ?? "top";
}

/** The inner component of the tooltip. */
// eslint-disable-next-line react-refresh/only-export-components
function TooltipInner(props: TooltipInnerProps) {
  const {
    id,
    className,
    variant,
    rounded,
    size,
    maxWidth,
    children,
    testId,
    overlayPositionProps,
  } = props;

  const popoverRef = React.useRef<HTMLDivElement>(null);

  const placement = overlayPositionProps.placement ?? "bottom";
  const positionArea = getPositionArea(placement);

  React.useLayoutEffect(() => {
    if (popoverRef.current) {
      const ref = popoverRef.current;
      ref.showPopover();
      return () => {
        ref.hidePopover();
      };
    }
  }, []);

  return (
    <span
      ref={popoverRef}
      {...({
        id,
        className: ariaComponents.TOOLTIP_STYLES({
          className,
          variant,
          rounded,
          size,
          maxWidth,
        }),
        "aria-hidden": true,
        popover: "manual",
        role: "presentation",
        "data-testid": testId,
        style: {
          positionAnchor: `--${id}`,
          positionArea,
          positionTry: "flip-block",
        },
      } as React.HTMLAttributes<HTMLSpanElement>)}
    >
      {children}
    </span>
  );
}

const DISPLAY_STRATEGIES: Record<DisplayStrategy, (target: HTMLElement) => boolean> = {
  always: () => true,
  whenOverflowing: (target) =>
    target.scrollWidth > target.clientWidth || target.scrollHeight > target.clientHeight,
};
