/**
 * FlameGraphTimeline Web Worker
 * Handles off-main-thread rendering of timeline ticks
 */

import type { TimeRange, ViewState } from "./types";
import {
  format,
  generateNiceTicks,
  MIN_TICK_SPACING,
  PADDING_LEFT,
} from "./utilities";
import { timeline } from "./styles";

// Worker state
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

// Message types
export interface InitMessage {
  type: "init";
  canvas: OffscreenCanvas;
}

export interface ResizeMessage {
  type: "resize";
  width: number;
  height: number;
  dpr: number;
}

export interface DrawMessage {
  type: "draw";
  width: number;
  height: number;
  dpr: number;
  timeRange: TimeRange;
  viewState: ViewState;
}

export type WorkerMessage = InitMessage | ResizeMessage | DrawMessage;

function draw(msg: DrawMessage): void {
  if (!ctx || !canvas) return;

  const { width, height, dpr, timeRange, viewState } = msg;
  const { minTime, maxTime } = timeRange;
  const totalDuration = maxTime - minTime;

  // Reset transform and clear
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  if (totalDuration === 0) return;

  const { offsetX, zoom } = viewState;

  // Calculate visible time range
  const visibleDuration = totalDuration / zoom;
  const timeOffset = (-offsetX / (width * zoom)) * totalDuration;
  const visibleStart = minTime + timeOffset;
  const visibleEnd = visibleStart + visibleDuration;

  // Calculate target tick count based on viewport width
  const targetTickCount = Math.max(2, Math.floor(width / MIN_TICK_SPACING));

  // Generate nice ticks for the visible range (relative to minTime)
  const relativeStart = visibleStart - minTime;
  const relativeEnd = visibleEnd - minTime;
  const ticks = generateNiceTicks(
    Math.max(0, relativeStart),
    relativeEnd,
    targetTickCount
  );

  // Setup drawing context
  ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";

  // Relative time to X coordinate conversion (with padding offset)
  const relativeTimeToX = (relativeTime: number) =>
    ((relativeTime - relativeStart) / visibleDuration) * width + PADDING_LEFT;

  // Track drawn labels to avoid duplicates
  const drawnLabels = new Set<string>();

  // Draw ticks
  for (const tick of ticks) {
    const x = relativeTimeToX(tick);

    // Skip ticks outside visible area
    if (x < -20 || x > width + 20) continue;

    const label = format(tick);

    // Skip if this label was already drawn (prevents duplicates)
    if (drawnLabels.has(label)) continue;
    drawnLabels.add(label);

    // Tick mark
    ctx.fillStyle = timeline.tickMark;
    ctx.fillRect(Math.round(x), height - 6, 1, 6);

    // Label
    ctx.fillStyle = timeline.tickLabel;
    ctx.fillText(label, x, height - 10);
  }
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === "init") {
    canvas = msg.canvas;
    ctx = canvas.getContext("2d");
  } else if (msg.type === "resize") {
    if (canvas) {
      canvas.width = msg.width * msg.dpr;
      canvas.height = msg.height * msg.dpr;
    }
  } else if (msg.type === "draw") {
    draw(msg);
  }
};
