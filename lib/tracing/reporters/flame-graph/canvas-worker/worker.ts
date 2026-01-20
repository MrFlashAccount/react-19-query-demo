/**
 * FlameGraphCanvas Web Worker Entry Point
 * Handles off-main-thread rendering of flame graph spans
 *
 * Optimizations:
 * - IntervalTree for O(log n + m) span queries by time range
 * - Viewport clipping: only draws visible portion of spans
 * - Depth filtering: skips spans outside visible vertical range
 */

import { theme } from "../styles";
import {
  generateNiceTicks,
  MIN_TICK_SPACING,
  PADDING_LEFT,
} from "../utilities";
import { LaneCalculator } from "../LaneCalculator";
import { SpanRenderer } from "./SpanRenderer";
import { SpansIndex } from "./SpansIndex";
import { ROW_HEIGHT, ROW_GAP, PADDING_TOP } from "./constants";
import type {
  WorkerMessage,
  InitMessage,
  UpdateSpansMessage,
  DrawMessage,
} from "./types";
import {
  attachSpanBuffer,
  getSpanCount,
  type SpanBufferViews,
} from "../SpanBuffer";

// Worker state
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let spanRenderer: SpanRenderer | null = null;
const spansIndex = new SpansIndex();
const laneCalculator = new LaneCalculator();
let spanViews: SpanBufferViews | null = null;
let lastVersion = -1;

function handleInit(msg: InitMessage): void {
  canvas = msg.canvas;
  ctx = canvas.getContext("2d");
  spanRenderer = ctx
    ? new SpanRenderer(ctx, msg.colorPalette, msg.selectedBorderColor)
    : null;
  spanViews = attachSpanBuffer(msg.spanBuffer.sab, msg.spanBuffer.stringSab);
  lastVersion = -1;
}

function handleUpdateSpans(msg: UpdateSpansMessage): void {
  if (
    !spanViews ||
    spanViews.sab !== msg.spanBuffer.sab ||
    spanViews.stringSab !== msg.spanBuffer.stringSab
  ) {
    spanViews = attachSpanBuffer(msg.spanBuffer.sab, msg.spanBuffer.stringSab);
  }
  if (spanViews && msg.version !== lastVersion) {
    laneCalculator.calculate(spanViews);
    lastVersion = msg.version;
  }
}

function handleDraw(msg: DrawMessage): void {
  if (!ctx || !canvas || !spanRenderer) {
    throw new Error("Canvas not initialized");
  }

  const { width, height, dpr, selectedSpanId, timeRange, viewState } = msg;
  if (!spanViews) return;
  const spanCount = getSpanCount(spanViews);

  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }

  const { minTime, maxTime } = timeRange;
  const totalDuration = maxTime - minTime;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  if (totalDuration === 0 || spanCount === 0) return;

  // Build index for viewport queries (pass maxTime for running spans)
  spansIndex.build(spanViews, maxTime, laneCalculator);

  const { offsetX, offsetY, zoom } = viewState;
  const effectiveOffsetX = offsetX + PADDING_LEFT;
  const effectiveOffsetY = offsetY + PADDING_TOP;

  const timeToX = (time: number) =>
    ((time - minTime) / totalDuration) * width * zoom + effectiveOffsetX;
  const durationToWidth = (duration: number) =>
    (duration / totalDuration) * width * zoom;

  // Calculate visible ranges for virtualization (use effective offset to match drawing)
  const timePerPx = totalDuration / (width * zoom);
  const overscanTime = timePerPx * 20;
  const visibleTimeStart =
    minTime + (0 - effectiveOffsetX) * timePerPx - overscanTime;
  const visibleTimeEnd =
    minTime + (width - effectiveOffsetX) * timePerPx + overscanTime;

  const visibleDepthStart = Math.max(
    0,
    Math.floor((-offsetY - PADDING_TOP) / (ROW_HEIGHT + ROW_GAP))
  );
  const visibleDepthEnd = Math.ceil(
    (height - offsetY) / (ROW_HEIGHT + ROW_GAP)
  );

  // Draw vertical grid lines
  const targetTickCount = Math.max(2, Math.floor(width / MIN_TICK_SPACING));
  const visibleDuration = Math.max(0, visibleTimeEnd - visibleTimeStart);
  const relativeStart = visibleTimeStart - minTime;
  const relativeEnd = visibleTimeEnd - minTime;
  const ticks = generateNiceTicks(
    Math.max(0, relativeStart),
    relativeEnd,
    targetTickCount
  );

  const relativeTimeToX = (relativeTime: number) =>
    ((relativeTime - relativeStart) / visibleDuration) * width + PADDING_LEFT;

  ctx.strokeStyle = theme.timeline.gridLine;
  ctx.lineWidth = 1;

  for (const tick of ticks) {
    const x = Math.round(relativeTimeToX(tick)) + 0.5;
    if (x < PADDING_LEFT || x > width) continue;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Query and draw visible spans
  const visibleSpans = spansIndex.queryVisible(
    visibleTimeStart,
    visibleTimeEnd,
    visibleDepthStart,
    visibleDepthEnd
  );

  const currentTime = timeRange.maxTime;

  for (const index of visibleSpans) {
    const adjustedDepth = laneCalculator.getAdjustedDepth(index);
    spanRenderer.draw(
      spanViews,
      index,
      adjustedDepth,
      timeToX,
      durationToWidth,
      effectiveOffsetY,
      width,
      height,
      selectedSpanId,
      currentTime
    );
  }
}

function processMessage(msg: WorkerMessage): void {
  switch (msg.type) {
    case "init":
      handleInit(msg);
      break;
    case "updateSpans":
      handleUpdateSpans(msg);
      break;
    case "draw":
      handleDraw(msg);
      break;
  }
}

self.onmessage = (e: MessageEvent<WorkerMessage[]>) => {
  const data = e.data;

  if (!Array.isArray(data)) {
    throw new Error("Expected array of messages, got: " + JSON.stringify(data));
  }

  // Support array of messages for batching
  for (const msg of data) {
    processMessage(msg);
  }
};
