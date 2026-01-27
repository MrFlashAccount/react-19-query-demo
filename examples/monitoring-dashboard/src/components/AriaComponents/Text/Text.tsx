/** @file Text component */
import * as React from "react";

import * as aria from "@/components/aria";

import * as mergeRefs from "@/utilities/mergeRefs";
import * as twv from "@/utilities/tailwindVariants";

import type { TooltipElementType } from "@/components/AriaComponents";
import type { RefProp } from "@/components/AriaComponents/types";
import { memo } from "react";
import type { TestIdProps } from "../types";
import * as visualTooltip from "../VisualTooltip";
import * as textProvider from "./TextProvider";

/** Props for the Text component */
export interface TextProps
  extends
    Omit<aria.TextProps, "color">,
    twv.VariantProps<typeof TEXT_STYLE>,
    TestIdProps,
    RefProp<HTMLSpanElement> {
  readonly elementType?: keyof HTMLElementTagNameMap;
  readonly lineClamp?: number;
  readonly tooltip?: TooltipElementType;
  readonly tooltipTriggerRef?: React.RefObject<HTMLElement>;
  readonly tooltipDisplay?: visualTooltip.VisualTooltipOptions["display"] | "never";
  readonly tooltipPlacement?: aria.Placement;
  readonly tooltipOffset?: number;
  readonly tooltipCrossOffset?: number;
}

// eslint-disable-next-line react-refresh/only-export-components
export const TEXT_STYLE = twv.tv({
  base: "[text-box-trim:trim-both]",
  variants: {
    color: {
      custom: "",
      primary: "text-primary",
      danger: "text-danger",
      success: "text-success",
      accent: "text-accent",
      muted: "text-primary/40",
      disabled: "text-disabled",
      invert: "text-invert",
      inherit: "text-inherit",
      current: "text-current",
    },
    font: {
      default: "",
      naming: "font-naming",
    },
    // we use custom padding for the text variants to make sure the text is aligned with the grid
    // leading is also adjusted to make sure the text is aligned with the grid
    // leading should always be after the text size to make sure it is not stripped by twMerge
    variant: {
      custom: "",
      body: "text-xs leading-[20px]",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "body-sm": "text-[10px] leading-[16px]",
      h1: "text-[20px] leading-[29px]",
      subtitle: "text-[14px] leading-[20px]",
      caption: "text-[8px] leading-[12px]",
      overline: "text-[8px] leading-[16px] uppercase",
    },
    weight: {
      custom: "",
      default: "",
      bold: "font-bold",
      semibold: "font-semibold",
      extraBold: "font-extrabold",
      medium: "font-medium",
      normal: "font-normal",
      thin: "font-thin",
    },
    balance: {
      true: "text-balance",
    },
    transform: {
      none: "",
      normal: "normal-case",
      capitalize: "capitalize",
      lowercase: "lowercase",
      uppercase: "uppercase",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
    truncate: {
      true: "block truncate",
      /* eslint-disable @typescript-eslint/naming-convention */
      "1": "block truncate",
      "2": "line-clamp-2",
      "3": "line-clamp-3",
      "4": "line-clamp-4",
      "5": "line-clamp-5",
      "6": "line-clamp-6",
      "7": "line-clamp-7",
      "8": "line-clamp-8",
      "9": "line-clamp-9",
      custom: "line-clamp-(--line-clamp)",
      /* eslint-enable @typescript-eslint/naming-convention */
    },
    monospace: { true: "font-mono" },
    italic: { true: "italic" },
    nowrap: { true: "whitespace-nowrap", normal: "whitespace-normal", false: "" },
    textSelection: {
      auto: "",
      none: "select-none",
      word: "select-text",
      all: "select-all",
    },
  },
  defaultVariants: {
    variant: "body",
    font: "default",
    weight: "default",
    transform: "none",
    color: "primary",
    italic: false,
    nowrap: false,
    monospace: false,
    textSelection: "auto",
  },
  compoundVariants: [
    { variant: "body", weight: "default", className: "font-medium" },
    { variant: "body-sm", weight: "default", className: "font-medium" },
    { variant: "h1", weight: "default", className: "font-bold" },
    { variant: "subtitle", weight: "default", className: "font-bold" },
    { variant: "caption", weight: "default", className: "font-medium" },
    { variant: "overline", weight: "default", className: "font-medium" },
  ],
});

/** Text component that supports truncation and show a tooltip on hover when text is truncated */
// eslint-disable-next-line no-restricted-syntax
export function Text(props: TextProps) {
  const {
    className,
    variant,
    font,
    italic,
    weight,
    nowrap,
    monospace,
    transform,
    truncate,
    lineClamp = 1,
    children,
    color,
    balance,
    testId,
    elementType: ElementType = "span",
    tooltip: tooltipElement = children,
    tooltipDisplay = "whenOverflowing",
    tooltipPlacement,
    tooltipOffset,
    tooltipCrossOffset,
    textSelection,
    align,
    ref: forwardedRef,
    ...ariaProps
  } = props;

  const textElementRef = React.useRef<HTMLElement | null>(null);
  const textContext = textProvider.useTextContext();

  const textClasses = TEXT_STYLE({
    variant,
    font,
    weight,
    transform,
    monospace,
    italic,
    nowrap,
    truncate,
    color,
    balance,
    textSelection,
    className,
    align,
  });

  const isTooltipDisabled = () => {
    if (tooltipDisplay === "whenOverflowing") {
      return truncate == null;
    }
    if (tooltipDisplay === "always") {
      return tooltipElement === false || tooltipElement == null;
    }

    return tooltipDisplay === "never";
  };

  const { tooltip, targetProps } = visualTooltip.useVisualTooltip({
    isDisabled: isTooltipDisabled(),
    // React 19 `useRef(null)` returns `RefObject<T | null>`, but this hook expects `T`.
    targetRef: textElementRef as unknown as React.RefObject<HTMLElement>,
    display: tooltipDisplay === "never" ? () => false : tooltipDisplay,
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

  return (
    <textProvider.TextProvider value={{ isInsideTextComponent: true }}>
      <ElementType
        // @ts-expect-error This is caused by the type-safe `elementType` type.
        ref={(el) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          mergeRefs.mergeRefs(forwardedRef, textElementRef)(el);
        }}
        data-testid={testId}
        className={textClasses}
        {...aria.mergeProps<React.HTMLAttributes<HTMLElement>>()(
          ariaProps,
          targetProps,
          truncate === "custom"
            ? // eslint-disable-next-line @typescript-eslint/naming-convention,no-restricted-syntax
              ({ style: { "--line-clamp": `${lineClamp}` } } as React.HTMLAttributes<HTMLElement>)
            : {},
        )}
      >
        {children}
      </ElementType>

      {tooltip}
    </textProvider.TextProvider>
  );
}

/** Heading props */
export interface HeadingProps
  extends Omit<TextProps, "elementType" | "ref">, RefProp<HTMLHeadingElement> {
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  readonly level?: "1" | "2" | "3" | "4" | "5" | "6" | 1 | 2 | 3 | 4 | 5 | 6;
}

/** Heading component */
const Heading = memo(function Heading(props: HeadingProps) {
  const { level = 1, ref: forwardedRef, ...textProps } = props;
  return (
    <Text
      ref={forwardedRef as unknown as TextProps["ref"]}
      elementType={`h${level}`}
      variant="h1"
      balance
      {...textProps}
    />
  );
});

/** Text group component. It's used to visually group text elements together */
function TextGroup(props: React.PropsWithChildren) {
  return (
    <textProvider.TextProvider value={{ isInsideTextComponent: true }}>
      {props.children}
    </textProvider.TextProvider>
  );
}

Text.Heading = Heading;
Text.Group = TextGroup;
