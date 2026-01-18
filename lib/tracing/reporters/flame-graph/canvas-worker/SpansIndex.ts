/**
 * Manages spatial indexing for efficient viewport queries
 * Uses adjusted depths from LaneCalculator for proper windowing
 */

import type { FlameGraphSpan } from "../types";
import { IntervalTree } from "../IntervalTree";
import type { LaneCalculator } from "../LaneCalculator";

export class SpansIndex {
  private index = new IntervalTree();

  build(
    spans: FlameGraphSpan[],
    maxTime: number,
    laneCalculator: LaneCalculator
  ): void {
    this.index.buildWithAdjustedDepths(spans, maxTime, laneCalculator);
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
  ): FlameGraphSpan[] {
    return this.index.query(timeStart, timeEnd, depthStart, depthEnd);
  }
}

