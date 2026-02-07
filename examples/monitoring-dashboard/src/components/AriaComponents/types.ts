/** @file Common types for WAI-ARIA components. */
import type { ReactElement, Ref } from "react";
import type { PopoverProps } from "react-aria-components";

export type Placement = Required<PopoverProps>["placement"];

/**
 * React 19: `ref` is a normal prop for function components.
 *
 * Usage:
 * `interface Props extends RefProp<HTMLDivElement> { ... }`
 */
export interface RefProp<RefType> {
  readonly ref?: Ref<RefType> | undefined;
}

/**
 * Icon keys used by this example.
 * The original upstream list is not present in this repo; keep it wide for now.
 */
export type PossibleIcon = string;

/** Props for adding a test id to a component */
export interface TestIdProps {
  /** @deprecated */
  "data-testid"?: never;
  testId?: string | undefined;
}

/** Any icon. */
export type IconProp<Icon extends string = string, Render = never> =
  | IconPropSvgUse<Render>
  | LegacyIconProp<Icon, Render>;

/** The possible return values for a legacy icon. */
export type LegacyAvailableIconReturn<Icon extends string> =
  | LegacyIcon<Icon>
  | ReactElement
  | false
  | null
  | undefined;

/** The possible return values for a legacy icon. */
export type AvailableIconReturn = ReactElement | SvgUseIcon | false | null | undefined;

/**
 * Any legacy icon.
 * @deprecated Prefer defined keys over importing from `@/assets/*.svg`.
 */
export type LegacyIconProp<Icon extends string, Render> =
  | LegacyAvailableIconReturn<Icon>
  | ((render: Render) => LegacyAvailableIconReturn<Icon>);

/** Generic type for imported from figma icons. */
export type IconPropSvgUse<Render> =
  | AvailableIconReturn
  | ((render: Render) => AvailableIconReturn);

/** @deprecated */
export type LegacyIcon<T extends string> = Exclude<T, PossibleIcon> & {};

/** Any icon imported from Figma. */
export type SvgUseIcon = PossibleIcon;

/** Any addon. */
export type Addon<Render> =
  | ReactElement
  | string
  | false
  | ((render: Render) => ReactElement | string | false | null | undefined)
  | null
  | undefined;
