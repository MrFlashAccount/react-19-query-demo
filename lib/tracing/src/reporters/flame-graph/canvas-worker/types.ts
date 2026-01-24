/**
 * Message types for canvas worker communication
 */

import type { Color, SpanId } from "../../../types";
import type { SpanBufferDescriptor } from "../SpanBuffer";
import type { TimeRange, ViewState } from "../types";

export interface InitMessage {
  type: "init";
  canvas: OffscreenCanvas;
  colorPalette: Record<Color, string>;
  selectedBorderColor: string;
  spanBuffer: SpanBufferDescriptor;
}

export interface UpdateSpansMessage {
  type: "updateSpans";
  spanBuffer: SpanBufferDescriptor;
  version: number;
}

export interface DrawMessage {
  type: "draw";
  width: number;
  height: number;
  dpr: number;
  selectedSpanId: SpanId | null;
  timeRange: TimeRange;
  viewState: ViewState;
}

export type WorkerMessage = InitMessage | UpdateSpansMessage | DrawMessage;
