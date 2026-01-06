import { brand } from "../../../types";
import type { Color } from "../../types";
import { css } from "./utilities";

const OklchColor = brand<
  | `oklch(${number} ${number} ${number})`
  | `oklch(${number} ${number} ${number} / ${number})`,
  "OklchColor"
>();

type OklchColor = typeof OklchColor.type;

export const colorPalette = {
  50: OklchColor("oklch(0.96 0 0)"), // #F2F2F2
  100: OklchColor("oklch(0.88 0 0)"), // #D9D9D9
  500: OklchColor("oklch(0.62 0 0)"), // #8C8C8C
  800: OklchColor("oklch(0.22 0 0)"), // #262626
  900: OklchColor("oklch(0.13 0 0)"), // #0D0D0D
  error: OklchColor("oklch(0.63 0.24 27)"), // #EF4444
} as const satisfies Readonly<Record<string, OklchColor>>;

/** Semantic UI colors (neutral gray-based) */
export const ui = {
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
export const accent = {
  // Primary (Indigo)
  primary: OklchColor("oklch(0.55 0.24 264)"),
  primaryLight: OklchColor("oklch(0.64 0.21 268)"),
  primaryDark: OklchColor("oklch(0.49 0.26 265)"),
  primaryGlow: OklchColor("oklch(0.55 0.24 264 / 0.4)"),

  // Secondary (Green)
  secondary: OklchColor("oklch(0.72 0.19 145)"),
  secondaryLight: OklchColor("oklch(0.78 0.17 150)"),
  secondaryDark: OklchColor("oklch(0.62 0.18 145)"),

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

/** Button state colors */
export const button = {
  record: {
    bg: "oklch(0.63 0.24 27 / 0.15)",
    bgHover: "oklch(0.63 0.24 27 / 0.25)",
    border: "oklch(0.63 0.24 27 / 0.3)",
    text: accent.errorLight,
  },
  stop: {
    bg: "oklch(0.72 0.19 145 / 0.15)",
    bgHover: "oklch(0.72 0.19 145 / 0.25)",
    border: "oklch(0.72 0.19 145 / 0.3)",
    text: accent.success,
  },
} as const;

/** Timeline colors */
export const timeline = {
  tickMark: OklchColor("oklch(0.45 0 0)"), // More visible tick marks
  tickLabel: OklchColor("oklch(0.55 0 0)"), // Brighter labels
  gridLine: OklchColor("oklch(0.25 0 0)"), // Subtle vertical grid lines
} as const satisfies Readonly<Record<string, OklchColor>>;

/** Span text colors (for labels on colored backgrounds) */
export const spanText = {
  label: OklchColor("oklch(1 0 0 / 0.95)"), // Primary label
  duration: OklchColor("oklch(1 0 0 / 0.6)"), // Secondary duration
} as const satisfies Readonly<Record<string, OklchColor>>;

/** Shadow colors */
export const shadow = {
  panelDrop:
    "color-mix(in oklab, " + colorPalette[900] + " 60%, transparent 40%)",
  panelGlow:
    "color-mix(in oklab, " + colorPalette[500] + " 20%, transparent 80%)",
  toggleGlow:
    "color-mix(in oklab, " + colorPalette[500] + " 55%, transparent 45%)",
  toggleRecordGlow:
    "color-mix(in oklab, " + colorPalette.error + " 40%, transparent 60%)",
  toggleRecordGlowHover:
    "color-mix(in oklab, " + colorPalette.error + " 70%, transparent 30%)",
} as const;

/** Toggle button gradients */
export const toggle = {
  bgGradient: `linear-gradient(135deg, ${colorPalette[900]} 0%, ${colorPalette[800]} 100%)`,
  bgGradientRecord: `linear-gradient(135deg, ${colorPalette.error} 0%, ${colorPalette.error} 100%)`,
} as const;

/** Details panel colors */
export const details = {
  headerBg: "oklch(0 0 0 / 0.2)",
  labelKey: colorPalette[100],
  labelValue: colorPalette[100],
  spanName: accent.primaryLight, // Accent color for span name
  errorStatus: accent.errorLight, // Red for error status
} as const;

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

// =============================================================================
// CSS CUSTOM PROPERTIES (generated from JS)
// =============================================================================

/** Shared CSS custom properties */
export const CSS_VARS = css`
  :host {
    /* Backgrounds */
    --fg-bg-primary: ${ui.bgPrimary};
    --fg-bg-secondary: ${ui.bgSecondary};
    --fg-bg-overlay: ${ui.bgOverlay};

    /* Borders */
    --fg-border: ${ui.border};
    --fg-border-subtle: ${ui.borderSubtle};
    --fg-border-light: ${ui.borderLight};
    --fg-border-hover: ${ui.borderHover};

    /* Text */
    --fg-text: ${ui.text};
    --fg-text-muted: ${ui.textMuted};
    --fg-text-dim: ${ui.textDim};

    /* Accent */
    --fg-accent: ${accent.primary};
    --fg-accent-glow: ${accent.primaryGlow};
    --fg-error: ${accent.error};
    --fg-success: ${accent.success};

    /* Surfaces */
    --fg-surface-hover: ${ui.surfaceHover};
    --fg-surface-active: ${ui.surfaceActive};
    --fg-surface-subtle: ${ui.surfaceSubtle};

    /* Fonts */
    --fg-font: ui-sans-serif, system-ui, -apple-system, sans-serif;
    --fg-font-mono: ui-monospace, monospace;

    /* Radii */
    --fg-radius: 8px;
    --fg-radius-lg: 12px;
    --fg-radius-xl: 16px;
  }
`;

/** Base button styles */
export const BUTTON_STYLES = css`
  button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: var(--fg-radius);
    border: 1px solid ${ui.borderLight};
    background: ${ui.surfaceActive};
    color: var(--fg-text);
    font-size: 13px;
    font-family: var(--fg-font);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  button:hover {
    background: ${ui.surfaceHover};
    border-color: ${ui.borderHover};
  }
  button.record {
    background: ${button.record.bg};
    border-color: ${button.record.border};
    color: ${button.record.text};
  }
  button.record:hover {
    background: ${button.record.bgHover};
  }
  button.stop {
    background: ${button.stop.bg};
    border-color: ${button.stop.border};
    color: ${button.stop.text};
  }
  button.stop:hover {
    background: ${button.stop.bgHover};
  }
  button.icon-only {
    padding: 6px 8px;
    background: transparent;
    border: none;
  }
  button.icon-only:hover {
    background: ${ui.surfaceSubtle};
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
    background: ${ui.handleDefault};
    border-radius: 2px;
    transition: background 0.15s;
  }
  .resize-handle:hover::before {
    background: ${ui.handleHover};
  }
`;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/** Lighten a hex color */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.floor((num >> 16) + 255 * percent));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00ff) + 255 * percent));
  const b = Math.min(255, Math.floor((num & 0x0000ff) + 255 * percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

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
