/**
 * FlameGraphCanvas Web Worker
 * Handles off-main-thread rendering of flame graph spans
 *
 * Optimizations:
 * - IntervalTree for O(log n + m) span queries by time range
 * - Viewport clipping: only draws visible portion of spans
 * - Depth filtering: skips spans outside visible vertical range
 */

import type { Color } from "../../types";
import type { FlameGraphSpan, TimeRange, ViewState } from "./types";
import { ui, spanText, timeline } from "./styles";
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

export interface ResizeMessage {
  type: "resize";
  width: number;
  height: number;
  dpr: number;
}

export interface UpdateSpansMessage {
  type: "updateSpans";
  spans: FlameGraphSpan[];
}

export interface DrawMessage {
  type: "draw";
  width: number;
  height: number;
  dpr: number;
  pendingSpans: Array<[string, Partial<FlameGraphSpan>]>;
  selectedSpanId: string | null;
  timeRange: TimeRange;
  viewState: ViewState;
}

export type WorkerMessage =
  | InitMessage
  | ResizeMessage
  | UpdateSpansMessage
  | DrawMessage;

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

function roundRect(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
class Span {
  constructor(
    private ctx: OffscreenCanvasRenderingContext2D,
    private colorPalette: Record<Color, string>,
    private selectedBorderColor: string
  ) {}

  /**
   * Draw a completed span with viewport clipping optimization
   */
  drawCompleted(
    span: FlameGraphSpan,
    timeToX: (t: number) => number,
    durationToWidth: (d: number) => number,
    effectiveOffsetY: number,
    viewportWidth: number,
    viewportHeight: number,
    selectedSpanId: string | null
  ): void {
    const rawX = timeToX(span.startTime);
    const y = span.depth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;
    const rawW = Math.max(durationToWidth(span.duration), MIN_SPAN_WIDTH);
    const h = ROW_HEIGHT;

    if (
      rawX + rawW < 0 ||
      rawX > viewportWidth ||
      y + h < 0 ||
      y > viewportHeight
    )
      return;

    const margin = 2;
    const clippedX = Math.max(-margin, rawX);
    const clippedRight = Math.min(viewportWidth + margin, rawX + rawW);
    const clippedW = clippedRight - clippedX;

    const leftVisible = rawX >= 0;
    const rightVisible = rawX + rawW <= viewportWidth;
    const leftRadius = leftVisible ? SPAN_RADIUS : 0;
    const rightRadius = rightVisible ? SPAN_RADIUS : 0;

    const isSelected = span.spanId === selectedSpanId;
    const baseColor = span.color
      ? this.colorPalette[span.color]
      : this.colorPalette.primary;
    const bgColor =
      span.status === "error" ? this.colorPalette.error : baseColor;
    const finalBgColor = isSelected ? lightenColor(bgColor, 0.25) : bgColor;

    // Background
    this.ctx.fillStyle = finalBgColor;
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

    // Border
    if (isSelected) {
      this.ctx.strokeStyle = this.selectedBorderColor;
      this.ctx.lineWidth = 2;
    } else {
      this.ctx.strokeStyle = ui.borderLight;
      this.ctx.lineWidth = 1;
    }
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

    // Text with sticky label behavior
    this.drawText(span, rawX, y, rawW, h, viewportWidth);
  }

  /**
   * Draw a pending (in-progress) span with animated border and label
   */
  drawPending(
    pending: Partial<FlameGraphSpan>,
    timeToX: (t: number) => number,
    durationToWidth: (d: number) => number,
    effectiveOffsetY: number,
    viewportWidth: number,
    viewportHeight: number,
    currentTime: number,
    selectedSpanId: string | null
  ): void {
    if (pending.startTime === undefined || pending.depth === undefined) return;

    const rawX = timeToX(pending.startTime);
    const y = pending.depth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;
    const rawW = Math.max(
      durationToWidth(currentTime - pending.startTime),
      MIN_SPAN_WIDTH
    );
    const h = ROW_HEIGHT;

    if (
      rawX + rawW < 0 ||
      rawX > viewportWidth ||
      y + h < 0 ||
      y > viewportHeight
    )
      return;

    const isSelected = pending.spanId === selectedSpanId;
    const baseColor = pending.color
      ? this.colorPalette[pending.color]
      : this.colorPalette.primary;

    // Background with transparency
    this.ctx.fillStyle = isSelected
      ? lightenColor(baseColor, 0.15) + "cc"
      : baseColor + "88";
    this.ctx.beginPath();
    roundRect(this.ctx, rawX, y, rawW, h, SPAN_RADIUS);
    this.ctx.fill();

    // Dashed border (solid if selected)
    if (isSelected) {
      this.ctx.strokeStyle = this.selectedBorderColor;
      this.ctx.lineWidth = 2;
    } else {
      this.ctx.strokeStyle = baseColor;
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([4, 4]);
    }
    this.ctx.beginPath();
    roundRect(this.ctx, rawX, y, rawW, h, SPAN_RADIUS);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw label and "In progress" text
    this.drawPendingText(pending, rawX, y, rawW, h, viewportWidth);
  }

  private drawPendingText(
    pending: Partial<FlameGraphSpan>,
    rawX: number,
    y: number,
    rawW: number,
    h: number,
    viewportWidth: number
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
    const statusRight = visibleRight - rightPadding;
    const availableTextWidth = visibleWidth - leftPadding - rightPadding;

    const statusText = "⏳ In progress";
    this.ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
    const statusWidth = this.ctx.measureText(statusText).width;

    const minStatusSpace = 80;
    const showStatus = availableTextWidth > minStatusSpace + 20;
    const labelMaxWidth = showStatus
      ? availableTextWidth - statusWidth - 8
      : availableTextWidth;

    if (labelMaxWidth > 10 && pending.name) {
      this.ctx.fillStyle = spanText.label;
      this.ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      this.ctx.textAlign = "left";
      const label = truncateText(this.ctx, pending.name, labelMaxWidth);
      this.ctx.fillText(label, labelLeft, centerY);
    }

    if (showStatus) {
      this.ctx.fillStyle = spanText.duration;
      this.ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
      this.ctx.textAlign = "right";
      this.ctx.fillText(statusText, statusRight, centerY);
    }

    this.ctx.restore();
  }

  private drawText(
    span: FlameGraphSpan,
    rawX: number,
    y: number,
    rawW: number,
    h: number,
    viewportWidth: number
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
    const durationRight = visibleRight - rightPadding;
    const availableTextWidth = visibleWidth - leftPadding - rightPadding;

    const durationText = formatTime(span.duration);
    this.ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
    const durationWidth = this.ctx.measureText(durationText).width;

    const minDurationSpace = 50;
    const showDuration = availableTextWidth > minDurationSpace + 20;
    const labelMaxWidth = showDuration
      ? availableTextWidth - durationWidth - 8
      : availableTextWidth;

    if (labelMaxWidth > 10) {
      this.ctx.fillStyle = spanText.label;
      this.ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      this.ctx.textAlign = "left";
      const label = truncateText(this.ctx, span.name, labelMaxWidth);
      this.ctx.fillText(label, labelLeft, centerY);
    }

    if (showDuration) {
      this.ctx.fillStyle = spanText.duration;
      this.ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
      this.ctx.textAlign = "right";
      this.ctx.fillText(durationText, durationRight, centerY);
    }

    this.ctx.restore();
  }
}

/**
 * Manages collection of spans with spatial indexing for efficient viewport queries
 */
class SpansStore {
  private index = new IntervalTree();
  private spans: FlameGraphSpan[] = [];

  get isEmpty(): boolean {
    return this.spans.length === 0;
  }

  update(spans: FlameGraphSpan[]): void {
    this.spans = spans;
    this.index.build(spans);
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

  /**
   * Get set of all span IDs in the given visible range
   */
  getVisibleSpanIds(
    timeStart: number,
    timeEnd: number,
    depthStart: number,
    depthEnd: number
  ): Set<string> {
    const visible = this.queryVisible(timeStart, timeEnd, depthStart, depthEnd);
    return new Set(visible.map((s) => s.spanId));
  }
}

// Worker state
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let spanRenderer: Span | null = null;
const spansStore = new SpansStore();

function draw(msg: DrawMessage): void {
  if (!ctx || !canvas || !spanRenderer) return;

  const {
    width,
    height,
    dpr,
    pendingSpans,
    selectedSpanId,
    timeRange,
    viewState,
  } = msg;
  const { minTime, maxTime } = timeRange;
  const totalDuration = maxTime - minTime;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  if (totalDuration === 0 || (spansStore.isEmpty && pendingSpans.length === 0))
    return;

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

  // Query and draw visible completed spans
  const visibleSpans = spansStore.queryVisible(
    visibleTimeStart,
    visibleTimeEnd,
    visibleDepthStart,
    visibleDepthEnd
  );

  const completedSpanIds = new Set(visibleSpans.map((s) => s.spanId));

  for (const span of visibleSpans) {
    spanRenderer.drawCompleted(
      span,
      timeToX,
      durationToWidth,
      effectiveOffsetY,
      width,
      height,
      selectedSpanId
    );
  }

  // Draw pending spans (skip completed ones)
  const currentTime = performance.now();
  for (const [spanId, pending] of pendingSpans) {
    if (completedSpanIds.has(spanId)) continue;
    if (pending.depth === undefined) continue;
    if (pending.depth < visibleDepthStart || pending.depth > visibleDepthEnd)
      continue;

    spanRenderer.drawPending(
      pending,
      timeToX,
      durationToWidth,
      effectiveOffsetY,
      width,
      height,
      currentTime,
      selectedSpanId
    );
  }
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === "init") {
    canvas = msg.canvas;
    ctx = canvas.getContext("2d");
    spanRenderer = ctx
      ? new Span(ctx, msg.colorPalette, msg.selectedBorderColor)
      : null;
  } else if (msg.type === "resize") {
    if (canvas) {
      canvas.width = msg.width * msg.dpr;
      canvas.height = msg.height * msg.dpr;
    }
  } else if (msg.type === "updateSpans") {
    spansStore.update(msg.spans);
  } else if (msg.type === "draw") {
    draw(msg);
  }
};
