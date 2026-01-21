/**
 * Calculates lane assignments for parallel tasks with subtree-based grouping.
 *
 * Hybrid approach:
 * - Root tasks are packed into lanes (time-based collision avoidance)
 * - Within each root, concurrent siblings reserve vertical space for their subtrees
 * - This preserves parent-child visual hierarchy even with concurrent sub-spans
 */

import type { SpanBufferViews } from "./SpanBuffer";
import { getSpansCount } from "./SpanBuffer";

const LANE_GAP = 1; // 1 row of space between task lanes

export interface SpanLayout {
  adjustedDepth: number;
  lane: number;
}

export interface SpanLayouts {
  adjustedDepths: Int32Array;
  lanes: Int32Array;
  /** Parent index for each span (for connection rendering) */
  parentIndices: Int32Array;
  count: number;
}

function findRootIndex(
  index: number,
  parentIndex: Int32Array,
  rootByIndex: Int32Array
): number {
  let current = index;
  const trail: number[] = [];
  while (current >= 0 && parentIndex[current] >= 0) {
    const cached = rootByIndex[current];
    if (cached >= 0) {
      current = cached;
      break;
    }
    trail.push(current);
    current = parentIndex[current];
  }
  const root = current;
  for (const node of trail) {
    rootByIndex[node] = root;
  }
  return root;
}

/**
 * Build children map: parentIndex -> list of child indices
 */
function buildChildrenMap(
  views: SpanBufferViews,
  count: number
): Map<number, number[]> {
  const childrenMap = new Map<number, number[]>();

  for (let i = 0; i < count; i++) {
    const parent = views.parentIndex[i];
    if (parent >= 0) {
      const children = childrenMap.get(parent);
      if (children) {
        children.push(i);
      } else {
        childrenMap.set(parent, [i]);
      }
    }
  }

  // Sort children by start time for consistent ordering
  for (const children of childrenMap.values()) {
    children.sort((a, b) => views.startTime[a] - views.startTime[b]);
  }

  return childrenMap;
}

/**
 * Check if two spans overlap in time
 */
function overlapsInTime(views: SpanBufferViews, a: number, b: number): boolean {
  const aStart = views.startTime[a];
  const aEnd = views.status[a] === 1 ? Infinity : views.endTime[a];
  const bStart = views.startTime[b];
  const bEnd = views.status[b] === 1 ? Infinity : views.endTime[b];
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Group concurrent siblings together (siblings that overlap in time)
 */
function groupConcurrentSiblings(
  views: SpanBufferViews,
  siblings: number[]
): number[][] {
  if (siblings.length <= 1) return siblings.map((s) => [s]);

  const groups: number[][] = [];
  const visited = new Set<number>();

  for (const span of siblings) {
    if (visited.has(span)) continue;

    // Find all spans that overlap with this one (transitive)
    const group: number[] = [span];
    visited.add(span);

    let i = 0;
    while (i < group.length) {
      const current = group[i];
      for (const other of siblings) {
        if (!visited.has(other) && overlapsInTime(views, current, other)) {
          group.push(other);
          visited.add(other);
        }
      }
      i++;
    }

    groups.push(group.sort((a, b) => views.startTime[a] - views.startTime[b]));
  }

  return groups.sort((a, b) => views.startTime[a[0]] - views.startTime[b[0]]);
}

/**
 * Calculate the subtree height for each span (how many rows its subtree needs).
 * Returns a map of spanIndex -> subtreeHeight
 */
function calculateSubtreeHeights(
  views: SpanBufferViews,
  childrenMap: Map<number, number[]>,
  count: number
): Int32Array {
  const heights = new Int32Array(count).fill(1); // Each span needs at least 1 row

  // Process spans in reverse depth order (leaves first)
  const depthOrder: number[] = [];
  for (let i = 0; i < count; i++) {
    depthOrder.push(i);
  }
  depthOrder.sort((a, b) => views.depth[b] - views.depth[a]);

  for (const index of depthOrder) {
    const children = childrenMap.get(index);
    if (!children || children.length === 0) {
      heights[index] = 1;
      continue;
    }

    // Group concurrent children
    const concurrentGroups = groupConcurrentSiblings(views, children);

    let maxGroupHeight = 0;
    for (const group of concurrentGroups) {
      if (group.length === 1) {
        // Single child: height is child's subtree height
        maxGroupHeight = Math.max(maxGroupHeight, heights[group[0]]);
      } else {
        // Concurrent children: sum of all their subtree heights
        let groupHeight = 0;
        for (const child of group) {
          groupHeight += heights[child];
        }
        maxGroupHeight = Math.max(maxGroupHeight, groupHeight);
      }
    }

    heights[index] = 1 + maxGroupHeight; // 1 for self + children
  }

  return heights;
}

/**
 * Assign rows recursively, respecting subtree heights for concurrent siblings
 */
function assignRows(
  views: SpanBufferViews,
  childrenMap: Map<number, number[]>,
  subtreeHeights: Int32Array,
  adjustedDepths: Int32Array,
  rootIndex: number,
  startRow: number
): number {
  adjustedDepths[rootIndex] = startRow;

  const children = childrenMap.get(rootIndex);
  if (!children || children.length === 0) {
    return 1; // This span uses 1 row
  }

  // Group concurrent children
  const concurrentGroups = groupConcurrentSiblings(views, children);

  let maxChildHeight = 0;

  for (const group of concurrentGroups) {
    if (group.length === 1) {
      // Single child: place directly below parent
      const childHeight = assignRows(
        views,
        childrenMap,
        subtreeHeights,
        adjustedDepths,
        group[0],
        startRow + 1
      );
      maxChildHeight = Math.max(maxChildHeight, childHeight);
    } else {
      // Concurrent children: stack them vertically, each getting its subtree space
      let currentRow = startRow + 1;
      for (const child of group) {
        const childHeight = assignRows(
          views,
          childrenMap,
          subtreeHeights,
          adjustedDepths,
          child,
          currentRow
        );
        currentRow += childHeight;
      }
      maxChildHeight = Math.max(maxChildHeight, currentRow - startRow - 1);
    }
  }

  return 1 + maxChildHeight;
}

export function calculateSpanLayouts(
  views: SpanBufferViews,
  count: number = getSpansCount(views)
): SpanLayouts {
  const adjustedDepths = new Int32Array(count);
  const lanes = new Int32Array(count);
  const parentIndices = new Int32Array(count);

  if (count === 0) return { adjustedDepths, lanes, parentIndices, count };

  // Copy parent indices for connection rendering
  for (let i = 0; i < count; i++) {
    parentIndices[i] = views.parentIndex[i];
  }

  const rootByIndex = new Int32Array(count).fill(-1);
  const rootTasks: number[] = [];

  for (let i = 0; i < count; i++) {
    if (views.parentIndex[i] < 0) rootTasks.push(i);
  }

  for (let i = 0; i < count; i++) {
    rootByIndex[i] = findRootIndex(i, views.parentIndex, rootByIndex);
  }

  rootTasks.sort((a, b) => views.startTime[a] - views.startTime[b]);

  // Pack root tasks into lanes (time-based collision avoidance)
  const laneIntervals: Array<
    Array<{ start: number; end: number; root: number }>
  > = [];
  const rootToLane = new Int32Array(count).fill(-1);

  for (const rootIndex of rootTasks) {
    const effectiveEnd =
      views.status[rootIndex] === 1 ? Infinity : views.endTime[rootIndex];
    let assignedLane = -1;
    for (let laneIdx = 0; laneIdx < laneIntervals.length; laneIdx++) {
      const intervals = laneIntervals[laneIdx];
      let fits = true;
      for (const interval of intervals) {
        if (
          views.startTime[rootIndex] < interval.end &&
          interval.start < effectiveEnd
        ) {
          fits = false;
          break;
        }
      }
      if (fits) {
        assignedLane = laneIdx;
        break;
      }
    }
    if (assignedLane === -1) {
      assignedLane = laneIntervals.length;
      laneIntervals.push([]);
    }
    laneIntervals[assignedLane].push({
      start: views.startTime[rootIndex],
      end: effectiveEnd,
      root: rootIndex,
    });
    rootToLane[rootIndex] = assignedLane;
  }

  // Build tree structure and calculate subtree heights
  const childrenMap = buildChildrenMap(views, count);
  const subtreeHeights = calculateSubtreeHeights(views, childrenMap, count);

  // Calculate the maximum row used by each lane
  const laneMaxRow: number[] = [];
  for (let laneIdx = 0; laneIdx < laneIntervals.length; laneIdx++) {
    laneMaxRow[laneIdx] = 0;
  }

  // Assign rows within each root's subtree
  for (const rootIndex of rootTasks) {
    const lane = rootToLane[rootIndex];
    const usedRows = assignRows(
      views,
      childrenMap,
      subtreeHeights,
      adjustedDepths,
      rootIndex,
      0 // Start at row 0, will be offset by lane later
    );
    laneMaxRow[lane] = Math.max(laneMaxRow[lane], usedRows - 1);

    // Mark all spans in this subtree with the lane
    const stack = [rootIndex];
    while (stack.length > 0) {
      const current = stack.pop()!;
      lanes[current] = lane;
      const children = childrenMap.get(current);
      if (children) {
        stack.push(...children);
      }
    }
  }

  // Calculate lane offsets
  const laneOffsets: number[] = [];
  let currentOffset = 0;
  for (let laneIdx = 0; laneIdx < laneIntervals.length; laneIdx++) {
    laneOffsets[laneIdx] = currentOffset;
    currentOffset += laneMaxRow[laneIdx] + 1 + LANE_GAP;
  }

  // Apply lane offsets to adjusted depths
  for (let i = 0; i < count; i++) {
    const lane = lanes[i] ?? 0;
    adjustedDepths[i] = laneOffsets[lane] + adjustedDepths[i];
  }

  return { adjustedDepths, lanes, parentIndices, count };
}

export class LaneCalculator {
  private adjustedDepths = new Int32Array(0);
  private lanes = new Int32Array(0);
  private parentIndices = new Int32Array(0);
  private count = 0;

  calculate(views: SpanBufferViews): void {
    const count = getSpansCount(views);
    if (this.adjustedDepths.length < count) {
      this.adjustedDepths = new Int32Array(count);
      this.lanes = new Int32Array(count);
      this.parentIndices = new Int32Array(count);
    }
    const layouts = calculateSpanLayouts(views, count);
    this.adjustedDepths.set(layouts.adjustedDepths);
    this.lanes.set(layouts.lanes);
    this.parentIndices.set(layouts.parentIndices);
    this.count = count;
  }

  getAdjustedDepth(index: number): number {
    return this.adjustedDepths[index] ?? 0;
  }

  getParentIndex(index: number): number {
    return this.parentIndices[index] ?? -1;
  }

  getParentIndices(): Int32Array {
    return this.parentIndices;
  }

  getAdjustedDepths(): Int32Array {
    return this.adjustedDepths;
  }

  getCount(): number {
    return this.count;
  }
}
