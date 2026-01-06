/**
 * Interval Tree for efficient range queries on spans
 * Optimized for flame graph virtualization - finds spans overlapping a time range
 */

import type { FlameGraphSpan } from "./types";

interface Interval {
  start: number;
  end: number;
  span: FlameGraphSpan;
}

export class IntervalTree {
  private intervals: Interval[] = [];
  private sorted = false;

  /**
   * Insert a span into the tree
   */
  insert(span: FlameGraphSpan): void {
    this.intervals.push({
      start: span.startTime,
      end: span.startTime + span.duration,
      span,
    });
    this.sorted = false;
  }

  /**
   * Build tree from array of spans (more efficient than individual inserts)
   */
  build(spans: FlameGraphSpan[]): void {
    this.intervals = spans.map((span) => ({
      start: span.startTime,
      end: span.startTime + span.duration,
      span,
    }));
    this.sorted = false;
  }

  /**
   * Query spans that overlap with [start, end] time range
   * Optionally filter by depth range for full 2D virtualization
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
        const span = interval.span;

        // Optional depth filtering
        if (depthStart !== undefined && depthEnd !== undefined) {
          if (span.depth >= depthStart && span.depth <= depthEnd) {
            result.push(span);
          }
        } else {
          result.push(span);
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
