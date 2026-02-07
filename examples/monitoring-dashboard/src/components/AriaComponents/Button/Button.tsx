/** @file A styled button. */
import {
  memo,
  useRef,
  useTransition,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import * as aria from "@/components/aria";
import { Tooltip, TooltipTrigger } from "@/components/AriaComponents/Tooltip";
import { Icon as IconComponent } from "@/components/Icon";
import { StatelessSpinner } from "@/components/StatelessSpinner";
import { useEvent } from "@/hooks/useEvent";
import { useContextProps } from "../../hooks/useContextProps";
import { useDialogContext, useDialogPrerenderContext } from "../Dialog";
import { ButtonGroup, ButtonGroupJoin } from "./ButtonGroup";
import {
  ButtonContext,
  ButtonGroupProvider,
  useJoinedButtonPrivateContext,
  useMergedButtonStyles,
} from "./shared";
import type { ButtonProps } from "./types";
import { BUTTON_STYLES } from "./variants";

const ICON_LOADER_DELAY = 150;

/** A button allows a user to perform an action, with mouse, touch, and keyboard interactions. */
// Manually casting types to make TS infer the final type correctly (e.g. RenderProps in icon)
// eslint-disable-next-line no-restricted-syntax
export function Button(propsReplacement: ButtonProps) {
  let [props, ref] = useContextProps(propsReplacement, ButtonContext);
  props = useMergedButtonStyles(props);
  const dialogContext = useDialogContext();
  const prerenderContext = useDialogPrerenderContext();
  const {
    contentClassName,
    children,
    variant,
    icon,
    loading,
    isLoading,
    isActive,
    showIconOnHover,
    iconPosition,
    size,
    fullWidth,
    rounded,
    tooltip,
    tooltipPlacement,
    testId,
    loaderPosition = "full",
    extraClickZone: extraClickZoneProp,
    onPress = () => {},
    variants = BUTTON_STYLES,
    addonStart,
    addonEnd,
    hideLoader = false,
    ...ariaProps
  } = props;

  const { position, isJoined } = useJoinedButtonPrivateContext();
  const [implicitlyLoading, startTransition] = useTransition();

  const contentRef = useRef<HTMLSpanElement>(null);
  const loaderRef = useRef<HTMLSpanElement>(null);

  const isLink = ariaProps.href != null;

  const applyGoodDefaults = (() => {
    if (isLink) {
      // @ts-expect-error ts errors are expected here because we are merging props with different types
      props.rel = "noopener noreferrer";
    } else {
      // @ts-expect-error ts errors are expected here because we are merging props with different types
      props.type = "button" as const;
    }

    // @ts-expect-error ts errors are expected here because we are merging props with different types
    props["data-testid"] = testId;
  })();

  const isIconOnly = (children == null || children === "" || children === false) && icon != null;

  const shouldShowTooltip = (() => {
    if (tooltip === false) {
      return false;
    } else if (isIconOnly) {
      return true;
    } else {
      return tooltip != null;
    }
  })();

  const isLoadingFinal = (() => {
    if (typeof loading === "boolean") {
      return loading;
    }

    if (typeof isLoading === "boolean") {
      return isLoading;
    }

    return implicitlyLoading;
  })();

  const isDisabled = props.isDisabled ?? isLoadingFinal;
  const extraClickZone = extraClickZoneProp ?? variant === "icon";

  const handlePress = useEvent((event: aria.PressEvent) => {
    if (!isDisabled) {
      const result = onPress?.(event);

      if (result instanceof Promise) {
        startTransition(() => result);
      }

      if (dialogContext != null && "formMethod" in props && props.formMethod === "dialog") {
        dialogContext.close();
      }
    }
  });

  props.onPressStart = undefined;

  props.onPressEnd = useEvent((event: aria.PressEvent) => {
    if (!isDisabled) {
      handlePress(event);
    }
  });

  const tooltipElement = shouldShowTooltip ? (tooltip ?? ariaProps["aria-label"]) : null;
  const { buttonProps, isPressed } = aria.useButton(
    props,
    ref as RefObject<HTMLButtonElement | null>,
  );
  const { focusProps, isFocused, isFocusVisible } = aria.useFocusRing(props);
  const { hoverProps, isHovered } = aria.useHover({
    ...props,
    isDisabled: props.isDisabled || isLoadingFinal,
    onHoverStart: useEvent(() => {
      prerenderContext.enablePrerender();
    }),
    onHoverEnd: useEvent(() => {
      prerenderContext.disablePrerender();
    }),
  });

  const styles = variants({
    isDisabled,
    isActive,
    loading: isLoadingFinal,
    fullWidth,
    size,
    rounded,
    variant,
    iconPosition,
    showIconOnHover,
    extraClickZone,
    iconOnly: isIconOnly,
    isJoined,
    position,
  });

  const shouldDisplayBorder = isJoined && (position === "first" || position === "middle");

  const states = {
    isDisabled,
    isFocused,
    isHovered,
    isPressed,
    isFocusVisible,
    isCurrent: false,
    defaultClassName: "",
    isPending: isLoadingFinal,
  };

  const className = styles.base({
    className: typeof props.className === "function" ? props.className(states) : props.className,
    ...states,
  });

  const shouldShowOverlayLoader = () => {
    if (hideLoader) {
      return false;
    }

    return isLoadingFinal && loaderPosition === "full";
  };

  const button = (
    <button
      ref={ref}
      className={className}
      // @ts-expect-error ts errors are expected here because we are merging props with different types
      {...aria.mergeProps<aria.ButtonProps>()(buttonProps, hoverProps, focusProps, {
        isPending: isLoadingFinal,
        isDisabled,
      })}
    >
      <ButtonContent
        isIconOnly={isIconOnly}
        loaderPosition={loaderPosition}
        hideLoader={hideLoader}
        isLoading={isLoadingFinal}
        /* @ts-expect-error ts errors are expected here because we are merging props with different types */
        icon={icon}
        styles={styles}
        /* @ts-expect-error any here is safe because we transparently pass it to the children, and ts infer the type outside correctly */
        addonStart={addonStart}
        /* @ts-expect-error any here is safe because we transparently pass it to the children, and ts infer the type outside correctly */
        addonEnd={addonEnd}
      >
        {/* @ts-expect-error any here is safe because we transparently pass it to the children, and ts infer the type outside correctly */}
        {typeof children === "function" ? children(render) : children}
      </ButtonContent>

      {shouldShowOverlayLoader() && (
        <span ref={loaderRef} className={styles.loader()}>
          <StatelessSpinner state="loading-medium" size={16} />
        </span>
      )}

      {shouldDisplayBorder && <div className={styles.joinSeparator()} />}
    </button>
  );

  if (tooltipElement == null) {
    return button;
  }

  return (
    <TooltipTrigger delay={0} closeDelay={0}>
      {button}

      <Tooltip {...(tooltipPlacement != null ? { placement: tooltipPlacement } : {})}>
        {tooltipElement}
      </Tooltip>
    </TooltipTrigger>
  );
}

Button.Group = ButtonGroup;
Button.GroupJoin = ButtonGroupJoin;
Button.GroupProvider = ButtonGroupProvider;

/** Props for {@link ButtonContent}. */
interface ButtonContentProps {
  readonly hideLoader: boolean;
  readonly isIconOnly: boolean;
  readonly isLoading: boolean;
  readonly loaderPosition: "full" | "icon";
  readonly icon: ReactElement | string | null | undefined;
  readonly styles: ReturnType<typeof BUTTON_STYLES>;
  readonly children: ReactNode;
  readonly addonStart?: ReactElement | string | false | null | undefined;
  readonly addonEnd?: ReactElement | string | false | null | undefined;
}

/** Check if an addon is present. */
function hasAddon(addon: ButtonContentProps["addonEnd"]): boolean {
  return addon != null && addon !== false && addon !== "";
}

/** Render the content of a button. */
const ButtonContent = memo(function ButtonContent(props: ButtonContentProps) {
  const {
    isIconOnly,
    isLoading,
    loaderPosition,
    icon,
    styles,
    children,
    addonStart,
    addonEnd,
    hideLoader,
  } = props;

  // Icon only button
  if (isIconOnly) {
    return (
      <span className={styles.extraClickZone()}>
        {hasAddon(addonStart) && <div className={styles.addonStart()}>{addonStart}</div>}
        <Icon
          isLoading={isLoading}
          loaderPosition={loaderPosition}
          icon={icon}
          styles={styles}
          hideLoader={hideLoader}
        />
        {hasAddon(addonEnd) && <div className={styles.addonEnd()}>{addonEnd}</div>}
      </span>
    );
  }

  // Default button
  return (
    <>
      {hasAddon(addonStart) && <div className={styles.addonStart()}>{addonStart}</div>}
      <Icon
        isLoading={isLoading}
        loaderPosition={loaderPosition}
        icon={icon}
        styles={styles}
        hideLoader={hideLoader}
      />
      {children}
      {hasAddon(addonEnd) && <div className={styles.addonEnd()}>{addonEnd}</div>}
    </>
  );
});

/** Props for {@link Icon}. */
interface IconProps {
  readonly isLoading: boolean;
  readonly loaderPosition: "full" | "icon";
  readonly icon: ReactElement | string | null | undefined;
  readonly styles: ReturnType<typeof BUTTON_STYLES>;
  readonly hideLoader: boolean;
}

/** Renders an icon for a button. */
const Icon = memo(function Icon(props: IconProps) {
  const { isLoading, loaderPosition, icon, styles, hideLoader } = props;

  const shouldShowLoader = (() => {
    if (hideLoader) {
      return false;
    }

    return isLoading && loaderPosition === "icon";
  })();

  if (icon == null && !shouldShowLoader) {
    return null;
  }

  const actualIcon = (() => {
    return typeof icon === "string" ? (
      <IconComponent className={styles.icon()}>{icon}</IconComponent>
    ) : (
      icon
    );
  })();

  if (shouldShowLoader) {
    return (
      <div className={styles.icon()}>
        <StatelessSpinner state="loading-medium" size={16} />
      </div>
    );
  }

  return actualIcon;
});
