/** @file An option in a selector. */
import { ListBoxItem, type ListBoxItemProps } from "@/components/aria";
import type { RefProp } from "@/components/AriaComponents/types";
import type { VariantProps } from "@/utilities/tailwindVariants";
import { tv } from "@/utilities/tailwindVariants";
import { TEXT_STYLE } from "../../Text";

/** Props for a {@link MultiSelectorOption}. */
export interface MultiSelectorOptionProps
  extends
    ListBoxItemProps,
    VariantProps<typeof MULTI_SELECTOR_OPTION_STYLES>,
    RefProp<HTMLDivElement> {
  readonly label: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const MULTI_SELECTOR_OPTION_STYLES = tv({
  base: TEXT_STYLE({
    className:
      "flex flex-1 items-center justify-center min-h-8 relative overflow-clip cursor-pointer transition-[background-color,color,outline-offset] duration-200",
    variant: "body",
  }),
  variants: {
    rounded: {
      none: "rounded-none",
      small: "rounded-sm",
      medium: "rounded-md",
      large: "rounded-lg",
      xlarge: "rounded-xl",
      xxlarge: "rounded-2xl",
      xxxlarge: "rounded-3xl",
      full: "rounded-full",
    },
    size: {
      medium: { base: "px-[11px] pb-1.5 pt-2" },
      small: { base: "px-[11px] pb-0.5 pt-1" },
    },
    color: {
      primary:
        "selected:bg-primary selected:text-white hover:bg-primary/5 pressed:bg-primary/10 outline outline-2 outline-transparent -outline-offset-2 focus-visible:outline-primary focus-visible:outline-offset-0",
    },
    variant: {
      default: "",
      outline: "border-[0.5px] border-primary/20",
    },
  },
  defaultVariants: {
    size: "medium",
    rounded: "xxxlarge",
    color: "primary",
    variant: "default",
  },
});

export function MultiSelectorOption(props: MultiSelectorOptionProps) {
  const { label, size, rounded, color, variant, ...radioProps } = props;
  const { className } = props;
  const { ref: forwardedRef } = props;

  return (
    <ListBoxItem
      ref={forwardedRef}
      {...radioProps}
      className={(renderProps) =>
        MULTI_SELECTOR_OPTION_STYLES({
          className: typeof className === "function" ? className(renderProps) : className,
          size,
          rounded,
          color,
          variant,
        })
      }
    >
      {label}
    </ListBoxItem>
  );
}
