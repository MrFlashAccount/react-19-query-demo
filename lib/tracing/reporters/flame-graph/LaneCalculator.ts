/**
 * Calculates lane assignments for parallel tasks.
 * Root tasks are packed into lanes, and overlapping siblings at the same depth
 * are further packed into sub-lanes to avoid vertical overlap.
 */

import type { SpanBufferViews } from "./SpanBuffer";
import { getSpanCount } from "./SpanBuffer";

const LANE_GAP = 1; // 1 row of space between task lanes

export interface SpanLayout {
  adjustedDepth: number;
  lane: number;
}

export interface SpanLayouts {
  adjustedDepths: Int32Array;
  lanes: Int32Array;
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

export function calculateSpanLayouts(
  views: SpanBufferViews,
  count: number = getSpanCount(views)
): SpanLayouts {
  const adjustedDepths = new Int32Array(count);
  const lanes = new Int32Array(count);
  if (count === 0) return { adjustedDepths, lanes, count };

  const rootByIndex = new Int32Array(count).fill(-1);
  const rootTasks: number[] = [];

  for (let i = 0; i < count; i++) {
    if (views.parentIndex[i] < 0) rootTasks.push(i);
  }

  for (let i = 0; i < count; i++) {
    rootByIndex[i] = findRootIndex(i, views.parentIndex, rootByIndex);
  }

  rootTasks.sort((a, b) => views.startTime[a] - views.startTime[b]);

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

  const spansByRoot = new Map<number, number[]>();
  for (let i = 0; i < count; i++) {
    const rootIndex = rootByIndex[i];
    const list = spansByRoot.get(rootIndex);
    if (list) {
      list.push(i);
    } else {
      spansByRoot.set(rootIndex, [i]);
    }
  }

  const laneMaxRow: number[] = [];
  for (let laneIdx = 0; laneIdx < laneIntervals.length; laneIdx++) {
    laneMaxRow[laneIdx] = 0;
  }

  const subLaneByIndex = new Int32Array(count);

  for (const [rootIndex, indices] of spansByRoot.entries()) {
    const rootDepth = views.depth[rootIndex];
    let maxRelativeDepth = 0;
    const spansByDepth: number[][] = [];

    for (const index of indices) {
      const relativeDepth = views.depth[index] - rootDepth;
      if (!spansByDepth[relativeDepth]) spansByDepth[relativeDepth] = [];
      spansByDepth[relativeDepth].push(index);
      if (relativeDepth > maxRelativeDepth) maxRelativeDepth = relativeDepth;
    }

    const laneCounts = new Int32Array(maxRelativeDepth + 1);

    for (let depth = 0; depth <= maxRelativeDepth; depth++) {
      const depthSpans = spansByDepth[depth];
      if (!depthSpans || depthSpans.length === 0) continue;

      depthSpans.sort((a, b) => views.startTime[a] - views.startTime[b]);
      const laneEnds: number[] = [];

      for (const index of depthSpans) {
        const start = views.startTime[index];
        const effectiveEnd =
          views.status[index] === 1 ? Infinity : views.endTime[index];
        let assignedLane = -1;

        for (let laneIdx = 0; laneIdx < laneEnds.length; laneIdx++) {
          if (start >= laneEnds[laneIdx]) {
            assignedLane = laneIdx;
            break;
          }
        }

        if (assignedLane === -1) {
          assignedLane = laneEnds.length;
          laneEnds.push(effectiveEnd);
        } else {
          laneEnds[assignedLane] = effectiveEnd;
        }

        subLaneByIndex[index] = assignedLane;
      }

      laneCounts[depth] = laneEnds.length;
    }

    const depthOffsets = new Int32Array(maxRelativeDepth + 1);
    let currentOffset = 0;
    for (let depth = 0; depth <= maxRelativeDepth; depth++) {
      depthOffsets[depth] = currentOffset;
      const lanesAtDepth = laneCounts[depth];
      currentOffset += Math.max(1, lanesAtDepth);
    }

    const lane = rootToLane[rootIndex] ?? 0;
    for (const index of indices) {
      const relativeDepth = views.depth[index] - rootDepth;
      const relativeRow = depthOffsets[relativeDepth] + subLaneByIndex[index];
      adjustedDepths[index] = relativeRow;
      lanes[index] = lane;
      if (relativeRow > laneMaxRow[lane]) laneMaxRow[lane] = relativeRow;
    }
  }

  const laneOffsets: number[] = [];
  let currentOffset = 0;
  for (let laneIdx = 0; laneIdx < laneIntervals.length; laneIdx++) {
    laneOffsets[laneIdx] = currentOffset;
    currentOffset += laneMaxRow[laneIdx] + 1 + LANE_GAP;
  }

  for (let i = 0; i < count; i++) {
    const lane = lanes[i] ?? 0;
    adjustedDepths[i] = laneOffsets[lane] + adjustedDepths[i];
  }

  return { adjustedDepths, lanes, count };
}

export class LaneCalculator {
  private adjustedDepths = new Int32Array(0);
  private lanes = new Int32Array(0);
  private count = 0;

  calculate(views: SpanBufferViews): void {
    const count = getSpanCount(views);
    if (this.adjustedDepths.length < count) {
      this.adjustedDepths = new Int32Array(count);
      this.lanes = new Int32Array(count);
    }
    const layouts = calculateSpanLayouts(views, count);
    this.adjustedDepths.set(layouts.adjustedDepths);
    this.lanes.set(layouts.lanes);
    this.count = count;
  }

  getAdjustedDepth(index: number): number {
    return this.adjustedDepths[index] ?? 0;
  }

  getCount(): number {
    return this.count;
  }
}
