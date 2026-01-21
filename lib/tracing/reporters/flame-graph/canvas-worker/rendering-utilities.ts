/**
 * Low-level canvas rendering utilities
 */

import { CODE_TO_COLOR, type SpanBufferViews } from "../SpanBuffer";

/**
 * Lighten a hex color by a given amount (0-1)
 */
export function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);

  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));

  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Format time in human-readable format
 */
export function formatTime(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(2) + "s";
  if (ms >= 1) return ms.toFixed(2) + "ms";
  return (ms * 1000).toFixed(0) + "µs";
}

/**
 * Rounded rect with independent left/right corner radii
 * Used for clipped spans where one side extends beyond viewport
 */
export function roundRectAsymmetric(
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

/**
 * Truncate text with ellipsis if it exceeds maxWidth
 */
export function truncateText(
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
