/**
 * Renders connection lines between parent and child spans.
 * Shows parent-child relationships visually, especially useful for concurrent spans.
 */

import type { SpanBufferViews } from "../SpanBuffer";
import type { SpanId } from "../../../types";
import { readSpanId } from "../SpanBuffer";
import { theme } from "../styles";
import { ROW_HEIGHT, ROW_GAP } from "./constants";

export interface ConnectionRenderOptions {
  /** Only show connections for selected span and its ancestors/descendants */
  selectedOnly: boolean;
  /** Show connections on hover */
  hoveredSpanIndex: number | null;
}

export class ConnectionRenderer {
  private static readonly LINE_COLOR = theme.accent.selected;
  private static readonly HIGHLIGHT_COLOR = theme.accent.primary;
  private static readonly LINE_WIDTH = 1.5;
  private static readonly HIGHLIGHT_WIDTH = 2.5;
  private static readonly DOT_RADIUS = 4;

  constructor(private ctx: OffscreenCanvasRenderingContext2D) {}

  /**
   * Draw connection lines between parent and child spans
   */
  draw(
    views: SpanBufferViews,
    count: number,
    adjustedDepths: Int32Array,
    parentIndices: Int32Array,
    timeToX: (t: number) => number,
    durationToWidth: (d: number) => number,
    effectiveOffsetY: number,
    viewportWidth: number,
    viewportHeight: number,
    selectedSpanId: SpanId | null,
    currentTime: number
  ): void {
    // Find selected span index
    let selectedIndex = -1;
    if (selectedSpanId !== null) {
      for (let i = 0; i < count; i++) {
        if (readSpanId(views, i) === selectedSpanId) {
          selectedIndex = i;
          break;
        }
      }
    }

    // Build set of spans to highlight (selected + ancestors + descendants)
    const highlightSet = new Set<number>();
    if (selectedIndex >= 0) {
      // Add ancestors
      let current = selectedIndex;
      while (current >= 0) {
        highlightSet.add(current);
        current = parentIndices[current];
      }
      // Add descendants
      this.addDescendants(selectedIndex, parentIndices, count, highlightSet);
    }

    // Draw non-highlighted connections first (subtle)
    this.ctx.strokeStyle = ConnectionRenderer.LINE_COLOR;
    this.ctx.lineWidth = ConnectionRenderer.LINE_WIDTH;
    this.ctx.globalAlpha = 0.4;

    for (let i = 0; i < count; i++) {
      const parentIdx = parentIndices[i];
      if (parentIdx < 0) continue;
      if (highlightSet.has(i) && highlightSet.has(parentIdx)) continue;

      this.drawConnection(
        views,
        parentIdx,
        i,
        adjustedDepths,
        timeToX,
        durationToWidth,
        effectiveOffsetY,
        viewportWidth,
        viewportHeight,
        currentTime,
        false
      );
    }

    this.ctx.globalAlpha = 1;

    // Draw highlighted connections on top
    if (highlightSet.size > 0) {
      this.ctx.strokeStyle = ConnectionRenderer.HIGHLIGHT_COLOR;
      this.ctx.lineWidth = ConnectionRenderer.HIGHLIGHT_WIDTH;

      for (let i = 0; i < count; i++) {
        const parentIdx = parentIndices[i];
        if (parentIdx < 0) continue;
        if (!highlightSet.has(i) || !highlightSet.has(parentIdx)) continue;

        this.drawConnection(
          views,
          parentIdx,
          i,
          adjustedDepths,
          timeToX,
          durationToWidth,
          effectiveOffsetY,
          viewportWidth,
          viewportHeight,
          currentTime,
          true
        );
      }
    }
  }

  private addDescendants(
    index: number,
    parentIndices: Int32Array,
    count: number,
    result: Set<number>
  ): void {
    for (let i = 0; i < count; i++) {
      if (parentIndices[i] === index) {
        result.add(i);
        this.addDescendants(i, parentIndices, count, result);
      }
    }
  }

  private drawConnection(
    views: SpanBufferViews,
    parentIdx: number,
    childIdx: number,
    adjustedDepths: Int32Array,
    timeToX: (t: number) => number,
    _durationToWidth: (d: number) => number,
    effectiveOffsetY: number,
    viewportWidth: number,
    viewportHeight: number,
    _currentTime: number,
    isHighlighted: boolean
  ): void {
    const parentDepth = adjustedDepths[parentIdx];
    const childDepth = adjustedDepths[childIdx];

    // Calculate span positions
    const parentX = timeToX(views.startTime[parentIdx]);
    const parentY = parentDepth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;
    const childX = timeToX(views.startTime[childIdx]);
    const childY = childDepth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;

    // Parent: exit from BOTTOM of span (near left edge)
    const parentConnectX = parentX + 8;
    const parentConnectY = parentY + ROW_HEIGHT;

    // Child: enter from LEFT side (vertically centered)
    const childConnectX = childX;
    const childConnectY = childY + ROW_HEIGHT / 2;

    // Skip if completely outside viewport
    const minX = Math.min(parentConnectX, childConnectX) - 20;
    const maxX = Math.max(parentConnectX, childConnectX);
    const minY = Math.min(parentConnectY, childConnectY);
    const maxY = Math.max(parentConnectY, childConnectY);

    if (maxX < 0 || minX > viewportWidth || maxY < 0 || minY > viewportHeight) {
      return;
    }

    // Draw connection line with smooth bezier curve
    this.ctx.beginPath();

    // Start from parent bottom
    this.ctx.moveTo(parentConnectX, parentConnectY);

    // Calculate control points for smooth curve
    const verticalDist = childConnectY - parentConnectY;
    const horizontalOffset = Math.min(
      25,
      Math.abs(childConnectX - parentConnectX) * 0.3 + 12
    );

    // Use cubic bezier for smooth curve
    this.ctx.bezierCurveTo(
      parentConnectX,
      parentConnectY + verticalDist * 0.5, // First control - below parent
      childConnectX - horizontalOffset,
      childConnectY, // Second control - left of child
      childConnectX,
      childConnectY // End at child left side
    );

    this.ctx.stroke();

    // Draw dots at connection points
    if (isHighlighted) {
      const dotRadius = ConnectionRenderer.DOT_RADIUS;
      this.ctx.fillStyle = ConnectionRenderer.HIGHLIGHT_COLOR;

      // Dot at parent bottom
      this.ctx.beginPath();
      this.ctx.arc(parentConnectX, parentConnectY, dotRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // Dot at child left
      this.ctx.beginPath();
      this.ctx.arc(childConnectX, childConnectY, dotRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}
