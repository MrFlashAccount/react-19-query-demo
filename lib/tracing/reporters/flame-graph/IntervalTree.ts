/**
 * Interval Tree for efficient range queries on spans
 * Optimized for flame graph virtualization - finds spans overlapping a time range
 */

import type { SpanId } from "../../types";
import type { FlameGraphSpan } from "./types";

interface Interval {
  start: number;
  end: number;
  adjustedDepth: number;
  span: FlameGraphSpan;
}

/** Interface for getting adjusted depth from LaneCalculator */
interface DepthProvider {
  getLayout(spanId: SpanId): { adjustedDepth: number } | undefined;
}

export class IntervalTree {
  private intervals: Interval[] = [];
  private sorted = false;

  /**
   * Insert a span into the tree
   */
  insert(span: FlameGraphSpan, maxTime: number): void {
    this.intervals.push({
      start: span.startTime,
      // Running spans extend to maxTime
      end: span.status === "running" ? maxTime : span.endTime,
      adjustedDepth: span.depth,
      span,
    });
    this.sorted = false;
  }

  /**
   * Build tree from array of spans (more efficient than individual inserts)
   * @param maxTime - current maxTime for running spans to extend to
   */
  build(spans: FlameGraphSpan[], maxTime: number): void {
    this.intervals = spans.map((span) => ({
      start: span.startTime,
      // Running spans extend to maxTime
      end: span.status === "running" ? maxTime : span.endTime,
      adjustedDepth: span.depth,
      span,
    }));
    this.sorted = false;
  }

  /**
   * Build tree with adjusted depths from LaneCalculator
   * @param maxTime - current maxTime for running spans to extend to
   * @param depthProvider - provides adjusted depths for each span
   */
  buildWithAdjustedDepths(
    spans: FlameGraphSpan[],
    maxTime: number,
    depthProvider: DepthProvider
  ): void {
    this.intervals = spans.map((span) => {
      const layout = depthProvider.getLayout(span.spanId);
      return {
        start: span.startTime,
        end: span.status === "running" ? maxTime : span.endTime,
        adjustedDepth: layout?.adjustedDepth ?? span.depth,
        span,
      };
    });
    this.sorted = false;
  }

  /**
   * Query spans that overlap with [start, end] time range
   * Optionally filter by depth range for full 2D virtualization
   * Uses adjustedDepth for filtering when available
   */
  query(
    timeStart: number,
    timeEnd: number,
    depthStart?: number,
    depthEnd?: number
  ): FlameGraphSpan[] {
    if (this.intervals.length === 0) return [];

    // Sort by start time on first query
    if (!this.sorted) {
      this.intervals.sort((a, b) => a.start - b.start);
      this.sorted = true;
    }

    const result: FlameGraphSpan[] = [];

    // Binary search for first interval that could overlap
    // We want the first interval where end >= timeStart
    let lo = 0;
    let hi = this.intervals.length;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.intervals[mid].end < timeStart) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    // Scan forward collecting overlapping intervals
    for (let i = lo; i < this.intervals.length; i++) {
      const interval = this.intervals[i];

      // Past visible range - done
      if (interval.start > timeEnd) break;

      // Check overlap: interval overlaps [timeStart, timeEnd] if:
      // interval.start <= timeEnd AND interval.end >= timeStart
      if (interval.end >= timeStart) {
        // Optional depth filtering using adjustedDepth
        if (depthStart !== undefined && depthEnd !== undefined) {
          if (
            interval.adjustedDepth >= depthStart &&
            interval.adjustedDepth <= depthEnd
          ) {
            result.push(interval.span);
          }
        } else {
          result.push(interval.span);
        }
      }
    }

    return result;
  }

  /**
   * Clear all intervals
   */
  clear(): void {
    this.intervals = [];
    this.sorted = false;
  }

  /**
   * Get total count of intervals
   */
  get size(): number {
    return this.intervals.length;
  }
}
