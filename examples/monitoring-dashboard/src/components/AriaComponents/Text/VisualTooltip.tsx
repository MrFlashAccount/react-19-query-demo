import { Children, useRef, type PropsWithChildren, type ReactElement } from "react";
import { useVisualTooltip, type DisplayStrategy } from "../VisualTooltip";
import type { Placement, TestIdProps } from "../types";
import { mergeRefs } from "../../../utilities/mergeRefs";
import { mergeProps } from "react-aria";

export interface VisualTooltipProps extends Readonly<PropsWithChildren>, TestIdProps {
  readonly isDisabled?: boolean;
  readonly display?: DisplayStrategy | ((target: HTMLElement) => boolean) | undefined;
  readonly tooltipPlacement?: Placement | undefined;
  readonly tooltipOffset?: number | undefined;
  readonly tooltipCrossOffset?: number | undefined;
  readonly children: ReactElement | string | false | null | undefined;
}

export function VisualTooltip(props: VisualTooltipProps) {
  const {
    display = "whenOverflowing",
    isDisabled = false,
    children,
    tooltipPlacement,
    tooltipOffset,
    tooltipCrossOffset,
  } = props;

  const shouldShowTooltip = children !== false && children != null;
  const targetRef = useRef<HTMLElement>(null);

  const tooltipElement = shouldShowTooltip ? children : null;

  const { tooltip, targetProps } = useVisualTooltip({
    isDisabled,
    targetRef,
    display,
    children: tooltipElement,
    ...(tooltipPlacement || tooltipOffset != null || tooltipCrossOffset != null
      ? {
          overlayPositionProps: {
            ...(tooltipPlacement && { placement: tooltipPlacement }),
            ...(tooltipOffset != null && { offset: tooltipOffset }),
            ...(tooltipCrossOffset != null && { crossOffset: tooltipCrossOffset }),
          },
        }
      : {}),
  });

  const onlyChild = Children.only(children);

  if (onlyChild == null || onlyChild === false) {
    return null;
  }

  if (typeof onlyChild === "string") {
    return (
      <span ref={targetRef} {...targetProps}>
        {onlyChild}
      </span>
    );
  }

  const newProps = mergeProps(onlyChild.props as any, targetProps);
  newProps.ref = mergeRefs(targetRef, newProps.ref);
  onlyChild.props = newProps;

  return (
    <>
      {onlyChild}
      {tooltip}
    </>
  );
}
