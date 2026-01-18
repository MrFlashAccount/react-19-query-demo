/**
 * Calculates lane assignments for parallel tasks
 * Non-overlapping root tasks share the same lane (greedy interval packing)
 */

import type { SpanId } from "../../types";
import type { FlameGraphSpan } from "./types";

const LANE_GAP = 1; // 1 row of space between task lanes

/**
 * Span layout data computed by calculateSpanLayouts
 */
export interface SpanLayout {
  adjustedDepth: number;
  lane: number;
}

/**
 * Find the root task for a span by traversing up the parent chain
 */
function findRoot(
  span: FlameGraphSpan,
  spanById: Map<SpanId, FlameGraphSpan>
): SpanId {
  let current = span;
  while (current.parentSpanId) {
    const parent = spanById.get(current.parentSpanId);
    if (!parent) break;
    current = parent;
  }
  return current.spanId;
}

/**
 * Calculate lane assignments for all spans
 * Groups by root task, assigns lanes using greedy packing
 * @returns Map of spanId to SpanLayout
 */
export function calculateSpanLayouts(
  spans: FlameGraphSpan[]
): Map<SpanId, SpanLayout> {
  const layouts = new Map<SpanId, SpanLayout>();

  if (spans.length === 0) return layouts;

  // 1. Find root tasks (spans with no parent)
  const rootTasks: FlameGraphSpan[] = [];
  const spanById = new Map<SpanId, FlameGraphSpan>();

  for (const span of spans) {
    spanById.set(span.spanId, span);
    if (!span.parentSpanId) {
      rootTasks.push(span);
    }
  }

  // 2. Build task membership: spanId → rootId
  const spanToRoot = new Map<SpanId, SpanId>();
  for (const span of spans) {
    const rootId = findRoot(span, spanById);
    spanToRoot.set(span.spanId, rootId);
  }

  // 3. Sort root tasks by startTime
  rootTasks.sort((a, b) => a.startTime - b.startTime);

  // 4. Greedy lane assignment
  // lanes[i] = array of {start, end} intervals in that lane
  const lanes: Array<Array<{ start: number; end: number; taskId: SpanId }>> =
    [];
  const taskToLane = new Map<SpanId, number>();

  for (const task of rootTasks) {
    // Use Infinity for running tasks so they don't overlap with anything after
    const effectiveEnd = task.status === "running" ? Infinity : task.endTime;

    // Find first lane where task fits (no overlap)
    let assignedLane = -1;
    for (let laneIdx = 0; laneIdx < lanes.length; laneIdx++) {
      const lane = lanes[laneIdx];
      let fits = true;
      for (const interval of lane) {
        // Check overlap: intervals overlap if start1 < end2 AND start2 < end1
        if (task.startTime < interval.end && interval.start < effectiveEnd) {
          fits = false;
          break;
        }
      }
      if (fits) {
        assignedLane = laneIdx;
        break;
      }
    }

    // No fitting lane found, create new one
    if (assignedLane === -1) {
      assignedLane = lanes.length;
      lanes.push([]);
    }

    lanes[assignedLane].push({
      start: task.startTime,
      end: effectiveEnd,
      taskId: task.spanId,
    });
    taskToLane.set(task.spanId, assignedLane);
  }

  // 5. Calculate max depth per lane (relative to root)
  // Group spans by lane first
  const spansPerLane: Map<number, FlameGraphSpan[]> = new Map();
  for (const span of spans) {
    const rootId = spanToRoot.get(span.spanId)!;
    const lane = taskToLane.get(rootId) ?? 0;
    if (!spansPerLane.has(lane)) {
      spansPerLane.set(lane, []);
    }
    spansPerLane.get(lane)!.push(span);
  }

  // Calculate max relative depth per lane
  const laneMaxDepth: number[] = [];
  for (let laneIdx = 0; laneIdx < lanes.length; laneIdx++) {
    const laneSpans = spansPerLane.get(laneIdx) ?? [];
    let maxRelativeDepth = 0;
    for (const span of laneSpans) {
      const rootId = spanToRoot.get(span.spanId)!;
      const root = spanById.get(rootId)!;
      const relativeDepth = span.depth - root.depth;
      if (relativeDepth > maxRelativeDepth) {
        maxRelativeDepth = relativeDepth;
      }
    }
    laneMaxDepth[laneIdx] = maxRelativeDepth;
  }

  // 6. Calculate lane offsets (cumulative)
  const laneOffsets: number[] = [];
  let currentOffset = 0;
  for (let laneIdx = 0; laneIdx < lanes.length; laneIdx++) {
    laneOffsets[laneIdx] = currentOffset;
    // Next lane starts after this lane's max depth + 1 (for the row) + LANE_GAP
    currentOffset += laneMaxDepth[laneIdx] + 1 + LANE_GAP;
  }

  // 7. Store adjusted depth for each span
  for (const span of spans) {
    const rootId = spanToRoot.get(span.spanId)!;
    const root = spanById.get(rootId)!;
    const lane = taskToLane.get(rootId) ?? 0;
    const relativeDepth = span.depth - root.depth;
    const adjustedDepth = laneOffsets[lane] + relativeDepth;

    layouts.set(span.spanId, {
      adjustedDepth,
      lane,
    });
  }

  return layouts;
}

/**
 * Stateful wrapper for worker that needs to cache spans
 * Uses calculateSpanLayouts internally
 */
export class LaneCalculator {
  private spanLayouts = new Map<SpanId, SpanLayout>();
  private cachedSpans: FlameGraphSpan[] = [];

  getSpans(): FlameGraphSpan[] {
    return this.cachedSpans;
  }

  getLayout(spanId: SpanId): SpanLayout | undefined {
    return this.spanLayouts.get(spanId);
  }

  calculate(spans: FlameGraphSpan[]): void {
    this.cachedSpans = spans;
    this.spanLayouts = calculateSpanLayouts(spans);
  }
}
