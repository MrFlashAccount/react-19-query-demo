/**
 * @file
 *
 * Icon component that displays an icon based on different input.
 */
import type { ReactNode } from "react";
import { tv, type VariantProps } from "@/utilities/tailwindVariants";
import type { TestIdProps } from "../AriaComponents";

/**
 * Props for {@link Icon}.
 */
export type IconProps<Render = never> = BaseIconProps<Render> & {
  children: ReactNode | ((render: Render) => ReactNode);
};

/**
 * Base props for all icon types.
 */
interface BaseIconProps<Render = never> extends VariantProps<typeof ICON_STYLES>, TestIdProps {
  readonly className?: string | undefined;
  readonly renderProps?: Render;
  readonly alt?: string | undefined;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ICON_STYLES = tv({
  base: "flex-none aspect-square w-full h-full [&>svg]:stroke-current [&>svg]:w-full [&>svg]:h-full",
  variants: {
    color: {
      custom: "",
      primary: "text-primary",
      danger: "text-danger",
      success: "text-success",
      accent: "text-accent",
      muted: "text-primary/50",
      disabled: "text-disabled",
      invert: "text-invert",
      inherit: "text-inherit",
      current: "text-current",
    },
    size: {
      xsmall: "h-2 w-2",
      small: "h-3 w-3",
      medium: "h-4 w-4",
      large: "h-5 w-5",
      xlarge: "h-6 w-6",
      xxlarge: "h-7 w-7",
      xxxlarge: "h-8 w-8",
      xxxxlarge: "h-9 w-9",
      full: "h-full w-full",
    },
  },
  defaultVariants: {
    color: "current",
    size: "medium",
  },
});

/** Icon component that displays an icon based on different input. */
// eslint-disable-next-line no-restricted-syntax
export function Icon<Render = never>(props: IconProps<Render>) {
  const { className, variants = ICON_STYLES, size, testId, renderProps, color, alt } = props;

  const styles = variants({ size, className, color });

  return (
    <IconInternal<Render>
      icon={props.children}
      className={styles}
      testId={testId}
      renderProps={renderProps}
      alt={alt}
    />
  );
}

/** Props for {@link IconInternal}. */
interface IconInternalProps<Render = never> extends TestIdProps {
  readonly className?: string | undefined;
  readonly icon: ReactNode | ((render: Render) => ReactNode);
  readonly renderProps?: Render | undefined;
  readonly alt?: string | undefined;
}

/**
 * Internal icon component that displays an icon based on different input.
 * @internal
 */
function IconInternal<Render = never>(props: IconInternalProps<Render>) {
  const { className, testId, renderProps, icon, alt = "" } = props;

  const renderedIcon = typeof icon === "function" ? icon(renderProps as never) : icon;

  if (renderedIcon == null || renderedIcon === false) {
    return null;
  }

  return (
    <span className={className} data-testid={testId} role="img" aria-label={alt}>
      {renderedIcon}
    </span>
  );
}

/**
 * Props for {@link SvgUse}.
 */
export interface SvgUseProps extends TestIdProps {
  readonly icon: string;
  readonly className?: string | undefined;
  readonly alt?: string | undefined;
}

/**
 * A component that displays an SVG from the icons bundle file.
 * Please refer to Figma for the list of available icons.
 * Prefer using {@link Icon} instead.
 * @internal
 */
export function SvgUse(props: SvgUseProps) {
  const { icon, testId = "svg-use", className, alt = "" } = props;

  return (
    <svg
      className={className}
      data-testid={testId}
      role={alt.length > 0 ? "img" : "presentation"}
      viewBox="0 0 16 16"
      preserveAspectRatio="xMidYMid slice"
      aria-label={alt}
    >
      <use href={icon} className="h-full w-full" aria-hidden="true" data-icon={icon} />
    </svg>
  );
}
