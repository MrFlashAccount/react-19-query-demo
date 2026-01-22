import type { Color } from "../../types";
import { brand } from "lib/brand";

import { css } from "./utilities";

const OklchColor = brand<
  `oklch(${number} ${number} ${number})` | `oklch(${number} ${number} ${number} / ${number})`,
  "OklchColor"
>();

type OklchColor = typeof OklchColor.type;

export const theme = (() => {
  const family = {
    default: "ui-sans-serif, system-ui, sans-serif",
    monospace: "ui-monospace, monospace",
  } as const;
  const size = {
    default: 12,
    small: 10,
    large: 14,
  } as const;
  const weight = {
    default: 400,
    bold: 600,
  } as const;
  const radius = {
    default: 8,
    lg: 12,
    xl: 16,
  } as const;
  const lineHeight = {
    default: 1.5,
  } as const;

  const colorPalette = {
    50: OklchColor("oklch(0.96 0 0)"), // #F2F2F2
    100: OklchColor("oklch(0.88 0 0)"), // #D9D9D9
    500: OklchColor("oklch(0.62 0 0)"), // #8C8C8C
    800: OklchColor("oklch(0.22 0 0)"), // #262626
    900: OklchColor("oklch(0.13 0 0)"), // #0D0D0D
    error: OklchColor("oklch(0.63 0.24 27)"), // #EF4444
  } as const satisfies Readonly<Record<string, OklchColor>>;

  /** Semantic UI colors (neutral gray-based) */
  const ui = {
    // Backgrounds (based on gray palette)
    bgPrimary: colorPalette[900],
    bgSecondary: colorPalette[800],
    bgOverlay: OklchColor("oklch(0 0 0 / 0.3)"), // Transparent overlay

    // Borders
    border: OklchColor("oklch(1 0 0 / 0.08)"), // White 8%
    borderSubtle: OklchColor("oklch(1 0 0 / 0.06)"), // White 6%
    borderLight: OklchColor("oklch(1 0 0 / 0.12)"), // White 12%
    borderHover: OklchColor("oklch(1 0 0 / 0.2)"), // White 20%

    // Text (neutral grays)
    text: colorPalette[50],
    textMuted: colorPalette[100],
    textDim: colorPalette[500],

    // Interactive surfaces
    surfaceHover: OklchColor("oklch(1 0 0 / 0.1)"), // Button hover
    surfaceActive: OklchColor("oklch(1 0 0 / 0.05)"), // Button base
    surfaceSubtle: OklchColor("oklch(1 0 0 / 0.08)"), // Icon button hover

    // Resize handle
    handleDefault: OklchColor("oklch(1 0 0 / 0.2)"),
    handleHover: OklchColor("oklch(1 0 0 / 0.4)"),
  } as const satisfies Readonly<Record<string, OklchColor>>;

  /** Accent colors */
  const accent = {
    // Primary (Indigo)
    primary: OklchColor("oklch(0.55 0.24 264)"),
    primaryLight: OklchColor("oklch(0.64 0.21 268)"),
    primaryDark: OklchColor("oklch(0.49 0.26 265)"),
    primaryGlow: OklchColor("oklch(0.55 0.24 264 / 0.4)"),

    // Secondary (Green)
    secondary: OklchColor("oklch(0.72 0.19 145)"),
    secondaryLight: OklchColor("oklch(0.78 0.17 150)"),
    secondaryDark: OklchColor("oklch(0.62 0.18 145)"),

    black: OklchColor("oklch(0.2 0 0)"), //#333333
    white: OklchColor("oklch(0.9 0 0)"), //#FFFFFF

    // Tertiary (Amber)
    tertiary: OklchColor("oklch(0.78 0.16 75)"),
    tertiaryLight: OklchColor("oklch(0.84 0.15 85)"),
    tertiaryDark: OklchColor("oklch(0.68 0.16 65)"),

    // Semantic
    error: OklchColor("oklch(0.63 0.24 27)"),
    errorLight: OklchColor("oklch(0.80 0.10 20)"), // For text on error bg
    success: OklchColor("oklch(0.88 0.14 150)"),
    selected: OklchColor("oklch(0.80 0.12 195)"), // Cyan for selection
  } as const satisfies Readonly<Record<string, OklchColor>>;

  /** Timeline colors */
  const timeline = {
    tickMark: OklchColor("oklch(0.45 0 0)"), // More visible tick marks
    tickLabel: OklchColor("oklch(0.55 0 0)"), // Brighter labels
    gridLine: OklchColor("oklch(0.25 0 0)"), // Subtle vertical grid lines
  } as const satisfies Readonly<Record<string, OklchColor>>;

  /** Span text colors (for labels on colored backgrounds) */
  const spanText = {
    label: OklchColor("oklch(1 0 0)"), // Primary label
    duration: OklchColor("oklch(1 0 0)"), // Secondary duration
  } as const satisfies Readonly<Record<string, OklchColor>>;

  /** Shadow colors */
  const shadow = {
    panelDrop: `color-mix(in oklab, ${colorPalette[900]} 60%, transparent 40%)`,
    panelGlow: `color-mix(in oklab, ${colorPalette[500]} 20%, transparent 80%)`,
    toggleGlow: `color-mix(in oklab, ${colorPalette[500]} 55%, transparent 45%)`,
    toggleRecordGlow: `color-mix(in oklab, ${colorPalette.error} 40%, transparent 60%)`,
    toggleRecordGlowHover: `color-mix(in oklab, ${colorPalette.error} 70%, transparent 30%)`,
  } as const;

  /** Toggle button gradients */
  const toggle = {
    bgGradient: `linear-gradient(135deg, ${colorPalette[900]} 0%, ${colorPalette[800]} 100%)`,
    bgGradientRecord: `linear-gradient(135deg, ${colorPalette.error} 0%, ${colorPalette.error} 100%)`,
  } as const;

  /** Details panel colors */
  const details = {
    headerBg: "oklch(0 0 0 / 0.2)",
    labelKey: colorPalette[100],
    labelValue: colorPalette[100],
    spanName: accent.primaryLight, // Accent color for span name
    errorStatus: accent.errorLight, // Red for error status
  } as const;

  return {
    family,
    size,
    weight,
    radius,
    lineHeight,
    colorPalette,
    ui,
    accent,
    timeline,
    spanText,
    shadow,
    toggle,
    details,
  } as const;
})();

// =============================================================================
// SPAN COLOR PALETTE (for tracing - kept as hex for worker compatibility)
// =============================================================================

export const COLOR_PALETTE = {
  primary: OklchColor("oklch(0.62 0.21 264)"),
  "primary-light": OklchColor("oklch(0.68 0.21 264)"),
  "primary-dark": OklchColor("oklch(0.55 0.21 264)"),
  secondary: OklchColor("oklch(0.72 0.21 145)"),
  "secondary-light": OklchColor("oklch(0.79 0.21 145)"),
  "secondary-dark": OklchColor("oklch(0.63 0.21 145)"),
  tertiary: OklchColor("oklch(0.72 0.21 65)"),
  "tertiary-light": OklchColor("oklch(0.80 0.21 65)"),
  "tertiary-dark": OklchColor("oklch(0.64 0.21 65)"),
  error: OklchColor("oklch(0.63 0.21 25)"),
} as const satisfies Readonly<Record<Color, OklchColor>>;

export const SELECTED_BORDER_COLOR = "#22d3ee";

export interface TypographyStylesProps {
  /**
   * Font size in pixels
   * @default theme.size.default (12px)
   */
  fontSize?: number;
  /** Font weight
   * @default theme.weight.default (400)
   */
  fontWeight?: number;
  /** Line height
   * @default theme.lineHeight.default (1.5)
   */
  lineHeight?: number;
  /** Text color
   * @default theme.ui.text
   */
  color?: OklchColor;
}

export const TYPOGRAPHY_STYLES = ({
  fontSize = theme.size.default,
  fontWeight = theme.weight.default,
  lineHeight = theme.lineHeight.default,
  color = theme.ui.text,
}: TypographyStylesProps = {}) => css`
  font-family: ${theme.family.default};
  font-size: ${fontSize}px;
  font-weight: ${fontWeight};
  line-height: ${lineHeight};
  color: ${color};
  text-box-trim: trim-both;
`;

/** Base button styles */
export const BUTTON_STYLES = css`
  button {
    ${TYPOGRAPHY_STYLES()}
    padding: 2px 6px;
    border-radius: ${theme.radius.default}px;
    border: none;
    background: ${theme.ui.surfaceActive};
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
  }
  button:hover {
    background: ${theme.ui.surfaceHover};
    border-color: ${theme.ui.borderHover};
  }
  button.icon-only {
    padding: 6px 8px;
    background: transparent;
    border: none;
  }
  button.icon-only:hover {
    background: ${theme.ui.surfaceSubtle};
  }
`;

/** Resize handle styles */
export const RESIZE_HANDLE_STYLES = css`
  .resize-handle {
    position: absolute;
    left: 0;
    right: 0;
    height: 8px;
    cursor: ns-resize;
    background: transparent;
    z-index: 10;
  }
  .resize-handle::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 4px;
    background: ${theme.ui.handleDefault};
    border-radius: 2px;
    transition: background 0.15s;
  }
  .resize-handle:hover::before {
    background: ${theme.ui.handleHover};
  }
`;

/** Format time in human-readable format */
export function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Escape HTML for safe rendering */
export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export const PIP_STYLES = css`
  html {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  
  body {
    margin: 0;
    padding: 0;
    overflow: hidden;
    height: 100%;
    width: 100%;
  }
`;

export const RESET_CASCADE = css`
  all: unset;
  box-sizing: border-box;
  color: inherit;
  font-family: inherit;
  
  &::before,
  &::after,
  ::before,
  ::after {
    all: unset;
    box-sizing: border-box;
    color: inherit;
    font-family: inherit;
  }
`;

/** CSS contain property values for isolation declarations */
type CSSContainValue =
  | "none"
  | "strict"
  | "content"
  | "size"
  | "layout"
  | "style"
  | "paint"
  | (string & {});

export const HOST_STYLES = ({
  contain = "content",
}: {
  contain?: CSSContainValue | false;
} = {}): string => css`
  :host {
    ${RESET_CASCADE}
    ${TYPOGRAPHY_STYLES()}
    ${contain !== false && `contain: ${contain};`}
  }
`;
