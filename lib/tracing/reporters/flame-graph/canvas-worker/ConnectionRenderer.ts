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
  private static readonly LINE_COLOR = theme.accent.secondary;
  private static readonly HIGHLIGHT_COLOR = theme.accent.secondaryDark;
  private static readonly LINE_WIDTH = 2;
  private static readonly DOT_RADIUS = 4;

  constructor(private ctx: OffscreenCanvasRenderingContext2D) {}

  /**
   * Draw connection lines between parent and child spans (virtualized)
   * Only draws connections for visible spans
   */
  draw(
    views: SpanBufferViews,
    visibleSpans: number[],
    adjustedDepths: Int32Array,
    parentIndices: Int32Array,
    timeToX: (t: number) => number,
    durationToWidth: (d: number) => number,
    effectiveOffsetY: number,
    viewportWidth: number,
    viewportHeight: number,
    selectedSpanId: SpanId | null
  ): void {
    if (visibleSpans.length === 0) return;

    // Find selected span index (only search visible spans)
    let selectedIndex = -1;
    if (selectedSpanId !== null) {
      for (const i of visibleSpans) {
        if (readSpanId(views, i) === selectedSpanId) {
          selectedIndex = i;
          break;
        }
      }
    }

    // Build set of spans to highlight (selected + ancestors within visible)
    const highlightSet = new Set<number>();
    if (selectedIndex >= 0) {
      // Add ancestors (traverse up, may go outside visible set)
      let current = selectedIndex;
      while (current >= 0) {
        highlightSet.add(current);
        current = parentIndices[current];
      }
      // Add visible descendants
      this.addVisibleDescendants(
        selectedIndex,
        parentIndices,
        visibleSpans,
        highlightSet
      );
    }

    // Draw non-highlighted connections first (subtle)
    this.ctx.fillStyle = ConnectionRenderer.LINE_COLOR;
    this.ctx.strokeStyle = ConnectionRenderer.LINE_COLOR;
    this.ctx.lineWidth = ConnectionRenderer.LINE_WIDTH;
    this.ctx.globalAlpha = 1;

    for (const childIdx of visibleSpans) {
      const parentIdx = parentIndices[childIdx];
      if (parentIdx < 0) continue;
      if (highlightSet.has(childIdx) && highlightSet.has(parentIdx)) continue;

      this.drawConnection(
        views,
        parentIdx,
        childIdx,
        adjustedDepths,
        timeToX,
        durationToWidth,
        effectiveOffsetY,
        viewportWidth,
        viewportHeight
      );
    }

    // Draw highlighted connections on top
    if (highlightSet.size > 0) {
      this.ctx.fillStyle = ConnectionRenderer.HIGHLIGHT_COLOR;
      this.ctx.strokeStyle = ConnectionRenderer.HIGHLIGHT_COLOR;
      this.ctx.lineWidth = ConnectionRenderer.LINE_WIDTH;

      for (const childIdx of visibleSpans) {
        const parentIdx = parentIndices[childIdx];
        if (parentIdx < 0) continue;
        if (!highlightSet.has(childIdx) || !highlightSet.has(parentIdx))
          continue;

        this.drawConnection(
          views,
          parentIdx,
          childIdx,
          adjustedDepths,
          timeToX,
          durationToWidth,
          effectiveOffsetY,
          viewportWidth,
          viewportHeight
        );
      }
    }
  }

  private addVisibleDescendants(
    index: number,
    parentIndices: Int32Array,
    visibleSpans: number[],
    result: Set<number>
  ): void {
    // Only check visible spans for descendants
    for (const i of visibleSpans) {
      if (parentIndices[i] === index) {
        result.add(i);
        this.addVisibleDescendants(i, parentIndices, visibleSpans, result);
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
    viewportHeight: number
  ): void {
    const parentDepth = adjustedDepths[parentIdx];
    const childDepth = adjustedDepths[childIdx];

    // Calculate span positions
    const parentX = timeToX(views.startTime[parentIdx]);
    const parentY = parentDepth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;
    const childX = timeToX(views.startTime[childIdx]);
    const childY = childDepth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;

    // Child: enter from LEFT edge (vertically centered)
    const childConnectX = childX + 1;
    const childConnectY = childY + ROW_HEIGHT / 2;

    // Determine connection style based on child offset
    const childOffset = childX - parentX;
    const isParabolic = childOffset < 10;

    // Parent connection point depends on child offset:
    // - Small offset: connect from LEFT edge of parent (same as child style)
    // - Large offset: connect from BOTTOM, near child's X (direct vertical)
    const parentConnectX = isParabolic
      ? parentX // Left edge, same as child
      : childX - 16; // Bottom, slightly left of child
    const parentConnectY = isParabolic
      ? parentY + ROW_HEIGHT / 2 // Vertically centered (same as child)
      : parentY + ROW_HEIGHT + 1; // Below span, clear rounded corner

    // Skip if completely outside viewport
    const minX = Math.min(parentConnectX, childConnectX) - 20;
    const maxX = Math.max(parentConnectX, childConnectX);
    const minY = Math.min(parentConnectY, childConnectY);
    const maxY = Math.max(parentConnectY, childConnectY);

    if (maxX < 0 || minX > viewportWidth || maxY < 0 || minY > viewportHeight) {
      return;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(parentConnectX, parentConnectY);

    const verticalDist = childConnectY - parentConnectY;

    if (isParabolic) {
      // Parabolic curve for left-side to left-side connections
      // Arc goes left then curves down to child
      const arcWidth = Math.max(15, verticalDist * 0.3);
      this.ctx.bezierCurveTo(
        parentConnectX - arcWidth,
        parentConnectY + verticalDist * 0.3, // Control 1: left and slightly down
        childConnectX - arcWidth,
        childConnectY - verticalDist * 0.3, // Control 2: left and slightly up from child
        childConnectX,
        childConnectY
      );
    } else {
      // Simple vertical curve for bottom connections
      // Almost straight down with slight ease into child
      this.ctx.quadraticCurveTo(
        parentConnectX,
        childConnectY, // Control: straight down to child's Y
        childConnectX,
        childConnectY
      );
    }

    this.ctx.stroke();

    // Draw tiny dots at both ends (always visible)
    const dotRadius = ConnectionRenderer.DOT_RADIUS;
    this.ctx.fillStyle = ConnectionRenderer.HIGHLIGHT_COLOR;

    // Dot at parent
    this.ctx.beginPath();
    this.ctx.arc(parentConnectX, parentConnectY, dotRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Dot at child
    this.ctx.beginPath();
    this.ctx.arc(childConnectX, childConnectY, dotRadius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}
