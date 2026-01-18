/**
 * Canvas Worker Client
 * Provides a typed API for interacting with the canvas worker
 * instead of raw postMessage calls
 */

import type { Color, SpanId } from "../../../types";
import type { FlameGraphSpan, TimeRange, ViewState } from "../types";
import type {
  WorkerMessage,
  InitMessage,
  UpdateSpansMessage,
  DrawMessage,
} from "./types";
import CanvasWorker from "./worker?worker";

export interface DrawParams {
  width: number;
  height: number;
  dpr: number;
  selectedSpanId: SpanId | null;
  timeRange: TimeRange;
  viewState: ViewState;
}

export interface InitParams {
  canvas: OffscreenCanvas;
  colorPalette: Record<Color, string>;
  selectedBorderColor: string;
}

/**
 * Message factories for creating typed worker messages
 */
export const msg = {
  updateSpans: (spans: FlameGraphSpan[]): UpdateSpansMessage => ({
    type: "updateSpans",
    spans,
  }),

  draw: (params: DrawParams): DrawMessage => ({
    type: "draw",
    width: params.width,
    height: params.height,
    dpr: params.dpr,
    selectedSpanId: params.selectedSpanId,
    timeRange: params.timeRange,
    viewState: params.viewState,
  }),
};

interface IPreInitCanvasWorkerClient {
  init(params: InitParams, transfer: Transferable[]): void;
}

interface ICanvasWorkerClientMethods {
  updateSpans(spans: FlameGraphSpan[]): this;
  draw(params: DrawParams): this;
  terminate(): void;
}
interface IPreBatchingCanvasWorkerClient extends ICanvasWorkerClientMethods {
  batch(): IBatchingCanvasWorkerClient;
}
interface IBatchingCanvasWorkerClient extends ICanvasWorkerClientMethods {
  send(...messages: WorkerMessage[]): void;
}

/**
 * Typed wrapper around the canvas web worker
 * Exposes methods instead of raw postMessage
 */
export class CanvasWorkerClient
  implements IPreBatchingCanvasWorkerClient, IPreInitCanvasWorkerClient
{
  private worker: Worker;
  private isInitialized = false;
  private isBatching = false;
  private batchMessages: WorkerMessage[] = [];

  constructor() {
    this.worker = new CanvasWorker();
  }

  /**
   * Initialize the worker with an OffscreenCanvas
   * @param params - Canvas and color configuration
   * @param transfer - Transferable objects (the OffscreenCanvas)
   */
  init(params: InitParams, transfer: Transferable[]) {
    if (this.isInitialized) {
      throw new Error("Worker already initialized, cannot re-initialize");
    }

    this.worker.postMessage(
      {
        type: "init",
        canvas: params.canvas,
        colorPalette: params.colorPalette,
        selectedBorderColor: params.selectedBorderColor,
      } satisfies InitMessage,
      transfer
    );
    this.isInitialized = true;
    return;
  }

  batch() {
    if (!this.isInitialized) {
      throw new Error("Worker not initialized");
    }
    this.isBatching = true;
    return this as unknown as IBatchingCanvasWorkerClient;
  }

  /**
   * Send one or more messages to the worker
   * Multiple messages are batched and processed together
   */
  send(...messages: WorkerMessage[]): void {
    this.sendMessages(
      messages,
      this.isBatching
    ) as unknown as IBatchingCanvasWorkerClient;
  }

  private sendMessages(
    messages: WorkerMessage[],
    isBatch: boolean = false
  ): void {
    if (!this.isInitialized) {
      throw new Error("Worker not initialized");
    }

    if (isBatch && !this.isBatching) {
      throw new Error("Cannot batch messages when not batching");
    }

    if (messages.length === 0) return;

    if (!isBatch && this.isBatching) {
      this.batchMessages.push(...messages);
      return;
    }

    this.worker.postMessage(messages);
  }

  /**
   * Convenience: Update spans data in the worker
   */
  updateSpans(spans: FlameGraphSpan[]) {
    this.sendMessages([msg.updateSpans(spans)]);
    return this;
  }

  /**
   * Convenience: Request a draw with the given parameters
   */
  draw(params: DrawParams) {
    this.sendMessages([msg.draw(params)]);
    return this;
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    this.worker.terminate();
    this.isInitialized = false;
    this.isBatching = false;
    this.batchMessages = [];
  }
}

// Re-export types for consumers
export type {
  WorkerMessage,
  InitMessage,
  UpdateSpansMessage,
  DrawMessage,
} from "./types";
export type { FlameGraphSpan, TimeRange, ViewState } from "../types";
