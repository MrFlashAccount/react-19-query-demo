/**
 * FlameGraphCanvas Web Worker Entry Point
 * Handles off-main-thread rendering of flame graph spans
 *
 * Optimizations:
 * - IntervalTree for O(log n + m) span queries by time range
 * - Viewport clipping: only draws visible portion of spans
 * - Depth filtering: skips spans outside visible vertical range
 */

import { timeline } from "../styles";
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

// Worker state
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let spanRenderer: SpanRenderer | null = null;
const spansIndex = new SpansIndex();
const laneCalculator = new LaneCalculator();

function handleInit(msg: InitMessage): void {
  canvas = msg.canvas;
  ctx = canvas.getContext("2d");
  spanRenderer = ctx
    ? new SpanRenderer(ctx, msg.colorPalette, msg.selectedBorderColor)
    : null;
}

function handleUpdateSpans(msg: UpdateSpansMessage): void {
  laneCalculator.calculate(msg.spans);
}

function handleDraw(msg: DrawMessage): void {
  if (!ctx || !canvas || !spanRenderer) return;

  const { width, height, dpr, selectedSpanId, timeRange, viewState } = msg;
  const spans = laneCalculator.getSpans();

  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }

  const { minTime, maxTime } = timeRange;
  const totalDuration = maxTime - minTime;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  if (totalDuration === 0 || spans.length === 0) return;

  // Build index for viewport queries (pass maxTime for running spans)
  spansIndex.build(spans, maxTime, laneCalculator);

  const { offsetX, offsetY, zoom } = viewState;
  const effectiveOffsetX = offsetX + PADDING_LEFT;
  const effectiveOffsetY = offsetY + PADDING_TOP;

  const timeToX = (time: number) =>
    ((time - minTime) / totalDuration) * width * zoom + effectiveOffsetX;
  const durationToWidth = (duration: number) =>
    (duration / totalDuration) * width * zoom;

  // Calculate visible ranges for virtualization
  const visibleDuration = totalDuration / zoom;
  const timeOffset = (-offsetX / (width * zoom)) * totalDuration;
  const visibleTimeStart = minTime + timeOffset;
  const visibleTimeEnd = visibleTimeStart + visibleDuration;

  const visibleDepthStart = Math.max(
    0,
    Math.floor((-offsetY - PADDING_TOP) / (ROW_HEIGHT + ROW_GAP))
  );
  const visibleDepthEnd = Math.ceil(
    (height - offsetY) / (ROW_HEIGHT + ROW_GAP)
  );

  // Draw vertical grid lines
  const targetTickCount = Math.max(2, Math.floor(width / MIN_TICK_SPACING));
  const relativeStart = visibleTimeStart - minTime;
  const relativeEnd = visibleTimeEnd - minTime;
  const ticks = generateNiceTicks(
    Math.max(0, relativeStart),
    relativeEnd,
    targetTickCount
  );

  const relativeTimeToX = (relativeTime: number) =>
    ((relativeTime - relativeStart) / visibleDuration) * width + PADDING_LEFT;

  ctx.strokeStyle = timeline.gridLine;
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

  for (const span of visibleSpans) {
    const layout = laneCalculator.getLayout(span.spanId);
    const adjustedDepth = layout?.adjustedDepth ?? span.depth;

    spanRenderer.draw(
      span,
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
    throw new Error("Expected array of messages");
  }

  // Support array of messages for batching
  for (const msg of data) {
    processMessage(msg);
  }
};
