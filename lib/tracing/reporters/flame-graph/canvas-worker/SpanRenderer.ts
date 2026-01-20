/**
 * Encapsulates rendering logic for a single span
 */

import type { Color, SpanId } from "../../../types";
import type { SpanBufferViews } from "../SpanBuffer";
import { CODE_TO_COLOR, readSpanId, readSpanName } from "../SpanBuffer";
import { theme } from "../styles";
import { PADDING_LEFT } from "../utilities";
import {
  ROW_HEIGHT,
  ROW_GAP,
  MIN_SPAN_WIDTH,
  SPAN_RADIUS,
  SPAN_PADDING_X,
  SPAN_PADDING_X_STICKY,
} from "./constants";
import {
  lightenColor,
  formatTime,
  roundRectAsymmetric,
  truncateText,
} from "./rendering";

export class SpanRenderer {
  private static readonly MARGIN_PX = 2;

  constructor(
    private ctx: OffscreenCanvasRenderingContext2D,
    private colorPalette: Record<Color, string>,
    private selectedBorderColor: string
  ) {}

  /**
   * Draw a span with viewport clipping optimization
   * Handles both running and ended spans in single pass
   */
  draw(
    views: SpanBufferViews,
    index: number,
    adjustedDepth: number,
    timeToX: (t: number) => number,
    durationToWidth: (d: number) => number,
    effectiveOffsetY: number,
    viewportWidth: number,
    viewportHeight: number,
    selectedSpanId: SpanId | null,
    currentTime: number
  ): void {
    const status = views.status[index];
    const isRunning = status === 1;
    const rawX = timeToX(views.startTime[index]);
    const y = adjustedDepth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;
    const duration = isRunning
      ? currentTime - views.startTime[index]
      : views.duration[index];
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

    const isSelected = readSpanId(views, index) === selectedSpanId;
    const colorCode = views.color[index];
    const color = CODE_TO_COLOR[colorCode as keyof typeof CODE_TO_COLOR];
    const baseColor = color
      ? this.colorPalette[color]
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

    // Pick style variants
    const fillColor = this.getFillColor(
      status,
      baseColor,
      isSelected,
      isRunning
    );
    const border = this.getBorderStyle(baseColor, isSelected, isRunning);

    // Draw background
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

    // Draw border
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

    // Draw text
    const rightLabel = isRunning
      ? "⏳ In progress"
      : formatTime(views.duration[index]);
    const minRightSpace = isRunning ? 80 : 50;
    this.drawSpanText(
      views,
      index,
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
    status: number,
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

    const bgColor = status === 3 ? this.colorPalette.error : baseColor;
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
    return { strokeStyle: theme.ui.borderLight, lineWidth: 1, dashed: false };
  }

  private drawSpanText(
    views: SpanBufferViews,
    index: number,
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
      this.ctx.fillStyle = theme.spanText.label;
      this.ctx.textAlign = "left";
      const label = truncateText(
        this.ctx,
        readSpanName(views, index),
        labelMaxWidth
      );
      this.ctx.fillText(label, labelLeft, centerY);
    }

    if (showRight) {
      this.ctx.fillStyle = theme.spanText.duration;
      this.ctx.textAlign = "right";
      this.ctx.fillText(rightLabel, rightTextX, centerY);
    }

    this.ctx.restore();
  }
}
