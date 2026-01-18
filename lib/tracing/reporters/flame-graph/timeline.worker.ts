/**
 * FlameGraphTimeline Web Worker
 * Handles off-main-thread rendering of timeline ticks
 */

import type { TimeRange } from "./types";
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

export interface DrawMessage {
  type: "draw";
  width: number;
  height: number;
  dpr: number;
  timeRange: TimeRange;
  offsetX: number;
  zoom: number;
}

export type WorkerMessage = InitMessage | DrawMessage;

function draw(msg: DrawMessage): void {
  if (!ctx || !canvas) return;

  const { width, height, dpr, timeRange, offsetX, zoom } = msg;
  const { minTime, maxTime } = timeRange;
  const totalDuration = maxTime - minTime;

  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }

  // Reset transform and clear
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  if (totalDuration === 0) return;

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

  switch (msg.type) {
    case "init":
      canvas = msg.canvas;
      ctx = canvas.getContext("2d");
      break;
    case "draw":
      draw(msg);
      break;
  }
};
