import { noopcb } from "../utils";
import {
  type ISpan,
  SpanBase,
  type ISpanChildOptions,
  type ISpanMeta,
  type ITracer,
  type IEventReceiver,
  type SpanState,
  type ITracerOptions,
  SpanId,
} from "./types";

const nullMeta: ISpanMeta = { description: "", color: "primary" };

/**
 * No-op span used by NullTracer in production.
 */
class NullSpan extends SpanBase implements ISpan {
  readonly name = "";
  readonly spanId = SpanId("-");
  get state(): SpanState {
    return "inactive";
  }
  get parentSpan(): undefined {
    return undefined;
  }
  get payload(): Record<string, unknown> {
    return {};
  }
  get meta(): ISpanMeta {
    return nullMeta;
  }
  get startTime(): number {
    return 0;
  }
  get endTime(): number {
    return 0;
  }
  get duration(): number {
    return 0;
  }
  get serializedPayload(): string {
    return "";
  }
  start(): void {}
  event(_eventName: string, _payload?: Record<string, unknown>): void {}
  success(_payload?: Record<string, unknown>): void {}
  error(_error: unknown, _payload?: Record<string, unknown>): void {}
  child(_options: ISpanChildOptions): ISpan {
    return this;
  }

  [Symbol.dispose](): void {}
}

/**
 * Null tracer that does nothing - used in production builds
 */
export class NullTracer implements ITracer {
  private readonly noOpSpan = new NullSpan();

  constructor(_options: ITracerOptions = {}) {}

  addReporter(_receiver: IEventReceiver): () => void {
    return noopcb();
  }

  deleteReporter(_receiver: IEventReceiver): void {}

  hasReporters(): boolean {
    return false;
  }

  createSpan(
    _name: string,
    _payload?: Record<string, unknown>,
    _meta?: ISpanMeta
  ): ISpan {
    return this.noOpSpan;
  }

  startSpan(
    _name: string,
    _payload?: Record<string, unknown>,
    _meta?: ISpanMeta
  ): ISpan {
    return this.noOpSpan;
  }
}
