/**
 * Renders connection lines between parent and child spans.
 * Shows parent-child relationships visually, especially useful for concurrent spans.
 */

import type { SpanBufferViews } from "../SpanBuffer";
import type { SpanId } from "../../../types";
import { readSpanId } from "../SpanBuffer";
import { theme } from "../styles";
import { ROW_HEIGHT, ROW_GAP, MIN_SPAN_WIDTH } from "./constants";

export interface ConnectionRenderOptions {
  /** Only show connections for selected span and its ancestors/descendants */
  selectedOnly: boolean;
  /** Show connections on hover */
  hoveredSpanIndex: number | null;
}

export class ConnectionRenderer {
  private static readonly LINE_COLOR = theme.ui.textDim;
  private static readonly HIGHLIGHT_COLOR = theme.accent.selected;
  private static readonly LINE_WIDTH = 1;
  private static readonly HIGHLIGHT_WIDTH = 2;
  private static readonly DOT_RADIUS = 3;

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
    this.ctx.globalAlpha = 0.3;

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
    durationToWidth: (d: number) => number,
    effectiveOffsetY: number,
    viewportWidth: number,
    viewportHeight: number,
    currentTime: number,
    isHighlighted: boolean
  ): void {
    const parentDepth = adjustedDepths[parentIdx];
    const childDepth = adjustedDepths[childIdx];

    // Calculate parent span geometry
    const parentIsRunning = views.status[parentIdx] === 1;
    const parentDuration = parentIsRunning
      ? currentTime - views.startTime[parentIdx]
      : views.endTime[parentIdx] - views.startTime[parentIdx];
    const parentX = timeToX(views.startTime[parentIdx]);
    const parentW = Math.max(durationToWidth(parentDuration), MIN_SPAN_WIDTH);
    const parentY = parentDepth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;

    // Calculate child span geometry
    const childX = timeToX(views.startTime[childIdx]);
    const childY = childDepth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;

    // Connection points
    const parentBottomY = parentY + ROW_HEIGHT;
    const childTopY = childY;

    // For concurrent siblings, draw from parent's bottom-left area
    // to child's top-left to show the tree structure
    const parentConnectX = Math.max(
      parentX + 8,
      Math.min(childX, parentX + parentW - 8)
    );
    const childConnectX = childX + 8;

    // Skip if completely outside viewport
    const minX = Math.min(parentConnectX, childConnectX);
    const maxX = Math.max(parentConnectX, childConnectX);
    const minY = Math.min(parentBottomY, childTopY);
    const maxY = Math.max(parentBottomY, childTopY);

    if (maxX < 0 || minX > viewportWidth || maxY < 0 || minY > viewportHeight) {
      return;
    }

    // Draw connection line (elbow style)
    this.ctx.beginPath();

    const midY = (parentBottomY + childTopY) / 2;

    // Vertical from parent bottom
    this.ctx.moveTo(parentConnectX, parentBottomY);
    this.ctx.lineTo(parentConnectX, midY);

    // Horizontal to child column
    this.ctx.lineTo(childConnectX, midY);

    // Vertical to child top
    this.ctx.lineTo(childConnectX, childTopY);

    this.ctx.stroke();

    // Draw small dots at connection points for highlighted connections
    if (isHighlighted) {
      const dotRadius = ConnectionRenderer.DOT_RADIUS;
      this.ctx.fillStyle = ConnectionRenderer.HIGHLIGHT_COLOR;

      // Dot at parent
      this.ctx.beginPath();
      this.ctx.arc(parentConnectX, parentBottomY, dotRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // Dot at child
      this.ctx.beginPath();
      this.ctx.arc(childConnectX, childTopY, dotRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}
