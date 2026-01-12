import type { Color, SpanId } from "../../types";

export interface FlameGraphSpan {
  spanId: SpanId;
  parentSpanId?: SpanId | undefined;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  depth: number;
  payload: Record<string, unknown>;
  status?: "success" | "error";
  color?: Color;
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

/** Events dispatched by flame graph components */
export type FlameGraphEvent =
  | { type: "record-start" }
  | { type: "record-stop" }
  | { type: "clear" }
  | { type: "close" }
  | { type: "span-select"; span: FlameGraphSpan | null };
