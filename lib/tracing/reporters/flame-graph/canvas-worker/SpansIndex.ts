/**
 * Manages spatial indexing for efficient viewport queries
 * Uses adjusted depths from LaneCalculator for proper windowing
 */

import type { SpanBufferViews } from "../SpanBuffer";
import { IntervalTree } from "../IntervalTree";
import type { LaneCalculator } from "../LaneCalculator";

export class SpansIndex {
  private index = new IntervalTree();

  build(
    views: SpanBufferViews,
    maxTime: number,
    laneCalculator: LaneCalculator
  ): void {
    this.index.buildWithAdjustedDepths(views, maxTime, laneCalculator);
  }

  /**
   * Query spans visible in the given time and depth ranges
   * Uses adjusted depths for filtering
   */
  queryVisible(
    timeStart: number,
    timeEnd: number,
    depthStart: number,
    depthEnd: number
  ): number[] {
    return this.index.query(timeStart, timeEnd, depthStart, depthEnd);
  }
}
