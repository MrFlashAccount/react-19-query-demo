/**
 * Interval Tree for efficient range queries on spans
 * Optimized for flame graph virtualization - finds spans overlapping a time range
 */

import type { SpanBufferViews } from "./SpanBuffer";
import { getSpanCount } from "./SpanBuffer";

interface Interval {
  start: number;
  end: number;
  adjustedDepth: number;
  index: number;
}

/** Interface for getting adjusted depth from LaneCalculator */
interface DepthProvider {
  getAdjustedDepth(index: number): number;
}

export class IntervalTree {
  private intervals: Interval[] = [];
  private sorted = false;

  build(
    views: SpanBufferViews,
    maxTime: number,
    count: number = getSpanCount(views)
  ): void {
    this.intervals = [];
    for (let i = 0; i < count; i++) {
      const end =
        views.status[i] === 1 ? maxTime : views.endTime[i];
      this.intervals.push({
        start: views.startTime[i],
        end,
        adjustedDepth: views.depth[i],
        index: i,
      });
    }
    this.sorted = false;
  }

  buildWithAdjustedDepths(
    views: SpanBufferViews,
    maxTime: number,
    depthProvider: DepthProvider,
    count: number = getSpanCount(views)
  ): void {
    this.intervals = [];
    for (let i = 0; i < count; i++) {
      const end =
        views.status[i] === 1 ? maxTime : views.endTime[i];
      this.intervals.push({
        start: views.startTime[i],
        end,
        adjustedDepth: depthProvider.getAdjustedDepth(i),
        index: i,
      });
    }
    this.sorted = false;
  }

  query(
    timeStart: number,
    timeEnd: number,
    depthStart?: number,
    depthEnd?: number
  ): number[] {
    if (this.intervals.length === 0) return [];

    if (!this.sorted) {
      this.intervals.sort((a, b) => a.start - b.start);
      this.sorted = true;
    }

    const result: number[] = [];

    // Linear scan - binary search on end doesn't work when sorted by start
    // A span with early start can have late end, so end values aren't ordered
    for (let i = 0; i < this.intervals.length; i++) {
      const interval = this.intervals[i];
      // Early exit: all remaining spans start after query window
      if (interval.start > timeEnd) break;
      // Check overlap: span.start <= timeEnd && span.end >= timeStart
      if (interval.end >= timeStart) {
        if (depthStart !== undefined && depthEnd !== undefined) {
          if (
            interval.adjustedDepth >= depthStart &&
            interval.adjustedDepth <= depthEnd
          ) {
            result.push(interval.index);
          }
        } else {
          result.push(interval.index);
        }
      }
    }

    return result;
  }

  clear(): void {
    this.intervals = [];
    this.sorted = false;
  }

  get size(): number {
    return this.intervals.length;
  }
}
