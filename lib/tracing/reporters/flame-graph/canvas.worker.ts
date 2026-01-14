/**
 * FlameGraphCanvas Web Worker
 * Handles off-main-thread rendering of flame graph spans
 *
 * Optimizations:
 * - IntervalTree for O(log n + m) span queries by time range
 * - Viewport clipping: only draws visible portion of spans
 * - Depth filtering: skips spans outside visible vertical range
 */

import { Color, SpanId } from "../../types";
import type { FlameGraphSpan, TimeRange, ViewState } from "./types";
import { ui, spanText, timeline, theme } from "./styles";
import { generateNiceTicks, MIN_TICK_SPACING, PADDING_LEFT } from "./utilities";
import { IntervalTree } from "./IntervalTree";

// Rendering constants
const ROW_HEIGHT = 28;
const ROW_GAP = 3;
const MIN_SPAN_WIDTH = 4;
const PADDING_TOP = 8;
const SPAN_RADIUS = 12;
const SPAN_PADDING_X = 12;
const SPAN_PADDING_X_STICKY = 4;

// Message types
export interface InitMessage {
  type: "init";
  canvas: OffscreenCanvas;
  colorPalette: Record<Color, string>;
  selectedBorderColor: string;
}

export interface DrawMessage {
  type: "draw";
  width: number;
  height: number;
  dpr: number;
  spans: FlameGraphSpan[];
  selectedSpanId: SpanId | null;
  timeRange: TimeRange;
  viewState: ViewState;
}

export type WorkerMessage = InitMessage | DrawMessage;

// Helper functions
function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function formatTime(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(2) + "s";
  if (ms >= 1) return ms.toFixed(2) + "ms";
  return (ms * 1000).toFixed(0) + "µs";
}

/**
 * Rounded rect with independent left/right corner radii
 * Used for clipped spans where one side extends beyond viewport
 */
function roundRectAsymmetric(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  leftR: number,
  rightR: number
): void {
  leftR = Math.min(leftR, w / 2, h / 2);
  rightR = Math.min(rightR, w / 2, h / 2);

  ctx.moveTo(x + leftR, y);
  ctx.lineTo(x + w - rightR, y);
  if (rightR > 0) {
    ctx.arcTo(x + w, y, x + w, y + h, rightR);
  } else {
    ctx.lineTo(x + w, y);
  }
  ctx.lineTo(x + w, y + h - rightR);
  if (rightR > 0) {
    ctx.arcTo(x + w, y + h, x, y + h, rightR);
  } else {
    ctx.lineTo(x + w, y + h);
  }
  ctx.lineTo(x + leftR, y + h);
  if (leftR > 0) {
    ctx.arcTo(x, y + h, x, y, leftR);
  } else {
    ctx.lineTo(x, y + h);
  }
  ctx.lineTo(x, y + leftR);
  if (leftR > 0) {
    ctx.arcTo(x, y, x + w, y, leftR);
  } else {
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function truncateText(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  const ellipsis = "…";
  let width = ctx.measureText(text).width;
  if (width <= maxWidth) return text;
  while (width > maxWidth && text.length > 0) {
    text = text.slice(0, -1);
    width = ctx.measureText(text + ellipsis).width;
  }
  return text + ellipsis;
}

/**
 * Encapsulates rendering logic for a single span
 */
class SpanRenderer {
  constructor(
    private ctx: OffscreenCanvasRenderingContext2D,
    private colorPalette: Record<Color, string>,
    private selectedBorderColor: string
  ) {}

  private static readonly MARGIN_PX = 2;

  /**
   * Draw a span with viewport clipping optimization
   * Handles both running and ended spans in single pass
   */
  draw(
    span: FlameGraphSpan,
    timeToX: (t: number) => number,
    durationToWidth: (d: number) => number,
    effectiveOffsetY: number,
    viewportWidth: number,
    viewportHeight: number,
    selectedSpanId: SpanId | null,
    currentTime: number
  ): void {
    const isRunning = span.status === "running";
    const rawX = timeToX(span.startTime);
    const y = span.depth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;
    const duration = isRunning ? currentTime - span.startTime : span.duration;
    const rawW = Math.max(durationToWidth(duration), MIN_SPAN_WIDTH);
    const h = ROW_HEIGHT;

    // Early exit if outside viewport
    if (
      rawX + rawW < 0 ||
      rawX > viewportWidth ||
      y + h < 0 ||
      y > viewportHeight
    )
      return;

    const isSelected = span.spanId === selectedSpanId;
    const baseColor = span.color
      ? this.colorPalette[span.color]
      : this.colorPalette.primary;

    const margin = SpanRenderer.MARGIN_PX;
    const clippedX = Math.max(-margin, rawX);
    const clippedRight = Math.min(viewportWidth + margin, rawX + rawW);
    const clippedW = clippedRight - clippedX;
    if (clippedW <= 0) return;

    const leftVisible = rawX >= 0;
    const rightVisible = rawX + rawW <= viewportWidth;
    const leftRadius = leftVisible ? SPAN_RADIUS : 0;
    const rightRadius = rightVisible ? SPAN_RADIUS : 0;

    // 2) Pick style “variants”
    const fillColor = this.getFillColor(span, baseColor, isSelected, isRunning);
    const border = this.getBorderStyle(baseColor, isSelected, isRunning);

    // 3) Draw background
    this.ctx.fillStyle = fillColor;
    this.ctx.beginPath();
    roundRectAsymmetric(
      this.ctx,
      clippedX,
      y,
      clippedW,
      h,
      leftRadius,
      rightRadius
    );
    this.ctx.fill();

    // 4) Draw border
    this.ctx.strokeStyle = border.strokeStyle;
    this.ctx.lineWidth = border.lineWidth;
    if (border.dashed) this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    roundRectAsymmetric(
      this.ctx,
      clippedX,
      y,
      clippedW,
      h,
      leftRadius,
      rightRadius
    );
    this.ctx.stroke();
    if (border.dashed) this.ctx.setLineDash([]);

    // 5) Draw text (shared), right label depends on variant
    const rightLabel = isRunning ? "⏳ In progress" : formatTime(span.duration);
    const minRightSpace = isRunning ? 80 : 50;
    this.drawSpanText(
      span,
      rawX,
      y,
      rawW,
      h,
      viewportWidth,
      rightLabel,
      minRightSpace
    );
  }

  private getFillColor(
    span: FlameGraphSpan,
    baseColor: string,
    isSelected: boolean,
    isRunning: boolean
  ): string {
    if (isRunning) {
      // transparent fill for running spans
      return isSelected
        ? lightenColor(baseColor, 0.15) + "cc"
        : baseColor + "88";
    }

    const bgColor =
      span.status === "error" ? this.colorPalette.error : baseColor;
    return isSelected ? lightenColor(bgColor, 0.25) : bgColor;
  }

  private getBorderStyle(
    baseColor: string,
    isSelected: boolean,
    isRunning: boolean
  ): { strokeStyle: string; lineWidth: number; dashed: boolean } {
    if (isSelected) {
      return {
        strokeStyle: this.selectedBorderColor,
        lineWidth: 2,
        dashed: false,
      };
    }
    if (isRunning) {
      return { strokeStyle: baseColor, lineWidth: 1, dashed: true };
    }
    return { strokeStyle: ui.borderLight, lineWidth: 1, dashed: false };
  }

  private drawSpanText(
    span: FlameGraphSpan,
    rawX: number,
    y: number,
    rawW: number,
    h: number,
    viewportWidth: number,
    rightLabel: string,
    minRightSpace: number
  ): void {
    const visibleLeft = Math.max(rawX, PADDING_LEFT);
    const visibleRight = Math.min(rawX + rawW, viewportWidth);
    const visibleWidth = visibleRight - visibleLeft;

    if (visibleWidth <= 30) return;

    const isLeftSticky = rawX < PADDING_LEFT;
    const isRightSticky = rawX + rawW > viewportWidth;
    const leftPadding = isLeftSticky ? SPAN_PADDING_X_STICKY : SPAN_PADDING_X;
    const rightPadding = isRightSticky ? SPAN_PADDING_X_STICKY : SPAN_PADDING_X;

    this.ctx.textBaseline = "middle";
    const centerY = y + h / 2;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(visibleLeft, y, visibleWidth, h);
    this.ctx.clip();

    const labelLeft = visibleLeft + leftPadding;
    const rightTextX = visibleRight - rightPadding;
    const availableTextWidth = visibleWidth - leftPadding - rightPadding;

    this.ctx.font = `${theme.size.default}px ${theme.family.default}`;
    const rightTextWidth = this.ctx.measureText(rightLabel).width;

    const showRight = availableTextWidth > minRightSpace + 20;
    const labelMaxWidth = showRight
      ? availableTextWidth - rightTextWidth - 8
      : availableTextWidth;

    if (labelMaxWidth > 10) {
      this.ctx.fillStyle = spanText.label;
      this.ctx.textAlign = "left";
      const label = truncateText(this.ctx, span.name, labelMaxWidth);
      this.ctx.fillText(label, labelLeft, centerY);
    }

    if (showRight) {
      this.ctx.fillStyle = spanText.duration;
      this.ctx.fillText(rightLabel, rightTextX, centerY);
    }

    this.ctx.restore();
  }
}

/**
 * Manages spatial indexing for efficient viewport queries
 */
class SpansIndex {
  private index = new IntervalTree();

  build(spans: FlameGraphSpan[], maxTime: number): void {
    this.index.build(spans, maxTime);
  }

  /**
   * Query spans visible in the given time and depth ranges
   */
  queryVisible(
    timeStart: number,
    timeEnd: number,
    depthStart: number,
    depthEnd: number
  ): FlameGraphSpan[] {
    return this.index.query(timeStart, timeEnd, depthStart, depthEnd);
  }
}

// Worker state
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let spanRenderer: SpanRenderer | null = null;
const spansIndex = new SpansIndex();

function draw(msg: DrawMessage): void {
  if (!ctx || !canvas || !spanRenderer) return;

  const { width, height, dpr, spans, selectedSpanId, timeRange, viewState } =
    msg;

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
  spansIndex.build(spans, maxTime);

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

  // Query and draw visible spans (single pass - handles both running and ended)
  const visibleSpans = spansIndex.queryVisible(
    visibleTimeStart,
    visibleTimeEnd,
    visibleDepthStart,
    visibleDepthEnd
  );

  const currentTime = timeRange.maxTime;

  for (const span of visibleSpans) {
    spanRenderer.draw(
      span,
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

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case "init":
      canvas = msg.canvas;
      ctx = canvas.getContext("2d");
      spanRenderer = ctx
        ? new SpanRenderer(ctx, msg.colorPalette, msg.selectedBorderColor)
        : null;
      break;
    case "draw":
      draw(msg);
      break;
  }
};
