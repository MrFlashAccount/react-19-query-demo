import type { Color, SpanId, SpanState } from "../../types";

export interface FlameGraphSpan {
  spanId: SpanId;
  parentSpanId: SpanId | null;
  name: string;
  startTime: number;
  endTime: number;
  depth: number;
  duration: number;
  status: SpanState;
  color: Color;
  payload?: Record<string, unknown>;
}

export interface FlameGraphReporterOptions {
  /** Z-index for the floating button and dialog. @default 9999 */
  zIndex?: number;
  /** Initial position of the toggle button. @default "bottom-right" */
  buttonPosition?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  /**
   * Container element or selector to mount the flame graph into.
   * If provided, the panel will be embedded in this container instead of using dialog.
   * The container should have explicit dimensions (width/height).
   */
  container?: HTMLElement | string;
}

export interface TimeRange {
  minTime: number;
  maxTime: number;
}

export interface ViewState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export type HandlePosition = "top" | "left" | "right" | "bottom";
export type Position = "left" | "right" | "bottom";

/** Calculated dimensions for a component */
export interface ComponentDimensions {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** CSS Grid configuration for the dialog content */
export interface GridConfig {
  /** Grid template areas string e.g. '"header header" "canvas details"' */
  templateAreas: string;
  /** Grid template columns e.g. [200, 400] */
  templateColumns: number[];
  /** Grid template rows e.g. [48, 28, 200, 32] */
  templateRows: number[];
}

/** Complete layout calculation result */
export interface LayoutResult {
  /** Dialog panel dimensions and position */
  dialog: ComponentDimensions & {
    /** CSS position properties */
    position: {
      top: string;
      left: string;
      right: string;
      bottom: string;
    };
  };
  /** Grid configuration for dialog content */
  grid: GridConfig;
  /** Individual component dimensions */
  header: ComponentDimensions;
  timeline: ComponentDimensions;
  canvas: ComponentDimensions;
  details: ComponentDimensions & { visible: boolean };
  statusBar: ComponentDimensions;
}

/** Layout configuration */
export interface LayoutConfig {
  dialogPosition: Position;
  detailsPosition: Position;
  dialogWidth: number; // for left/right position
  dialogHeight: number; // for bottom position
  detailsWidth: number; // for left/right position
  detailsHeight: number; // for bottom position
  detailsVisible: boolean;
}

/** Constant heights for layout calculation */
export const LAYOUT_CONSTANTS = {
  HEADER_HEIGHT: 36,
  TIMELINE_HEADER_HEIGHT: 28, // Fixed header part of timeline (ticks/labels)
  STATUS_BAR_HEIGHT: 32,
  MIN_CANVAS_HEIGHT: 100,
  MIN_CANVAS_WIDTH: 200,
  MIN_DIALOG_WIDTH: 300,
  MIN_DIALOG_HEIGHT: 300,
  MIN_DETAILS_WIDTH: 200,
  MIN_DETAILS_HEIGHT: 80,
  DEFAULT_DIALOG_WIDTH: 400,
  DEFAULT_DIALOG_HEIGHT: 350,
  DEFAULT_DETAILS_WIDTH: 280,
  DEFAULT_DETAILS_HEIGHT: 160,
} as const;

/** Events dispatched by flame graph components */
export type FlameGraphEvent =
  | { type: "record-start" }
  | { type: "record-stop" }
  | { type: "clear" }
  | { type: "close" }
  | { type: "span-select"; spanIndex: number | null };

export const MIN_VISIBLE_DURATION_MS = 1;
/**
 * Maximum zoom level that is still considered safe to render
 * and keep the numbers within SMI
 */
export const MAX_SAFE_ZOOM = 500_000;

/** Canvas padding and pan margin constants */
export const CANVAS_PADDING_LEFT = 12;
export const CANVAS_PADDING_RIGHT = 12;
export const CANVAS_PAN_MARGIN_PX = 20;
