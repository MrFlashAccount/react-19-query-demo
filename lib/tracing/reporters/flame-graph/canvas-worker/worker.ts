/**
 * FlameGraphCanvas Web Worker Entry Point
 * Handles off-main-thread rendering of flame graph spans
 *
 * Optimizations:
 * - IntervalTree for O(log n + m) span queries by time range
 * - Viewport clipping: only draws visible portion of spans
 * - Depth filtering: skips spans outside visible vertical range
 */

import { PADDING_LEFT } from "../utilities";
import { LaneCalculator } from "../LaneCalculator";
import { SpanRenderer } from "./SpanRenderer";
import { ConnectionRenderer } from "./ConnectionRenderer";
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
  getSpansCount,
  type SpanBufferViews,
} from "../SpanBuffer";

// Worker state
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let spanRenderer: SpanRenderer | null = null;
let connectionRenderer: ConnectionRenderer | null = null;
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
  connectionRenderer = ctx ? new ConnectionRenderer(ctx) : null;
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
  const spanCount = getSpansCount(spanViews);

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
  // Overscan: 10px for connections (parentConnectX = childX - 10)
  const timePerPx = totalDuration / (width * zoom);
  const overscanPx = 10;
  const overscanTime = timePerPx * overscanPx;
  const visibleTimeStart =
    minTime + (0 - effectiveOffsetX) * timePerPx - overscanTime;
  const visibleTimeEnd =
    minTime + (width - effectiveOffsetX) * timePerPx + overscanTime;

  const depthOverscan = 1; // 1 row for connections from parent above
  const visibleDepthStart = Math.max(
    0,
    Math.floor((-offsetY - PADDING_TOP) / (ROW_HEIGHT + ROW_GAP)) -
      depthOverscan
  );
  const visibleDepthEnd =
    Math.ceil((height - offsetY) / (ROW_HEIGHT + ROW_GAP)) + depthOverscan;

  const currentTime = timeRange.maxTime;

  // Query visible spans (includes overscan for connection rendering)
  const visibleSpans = spansIndex.queryVisible(
    visibleTimeStart,
    visibleTimeEnd,
    visibleDepthStart,
    visibleDepthEnd
  );

  // Draw connection lines (behind spans) - only for visible spans
  if (connectionRenderer) {
    connectionRenderer.draw(
      spanViews,
      visibleSpans,
      laneCalculator.getAdjustedDepths(),
      laneCalculator.getParentIndices(),
      timeToX,
      durationToWidth,
      effectiveOffsetY,
      width,
      height,
      selectedSpanId
    );
  }

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
