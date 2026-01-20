import type { SpanStartEvent, SpanEndEvent, TraceEvent } from "../types";
import { BaseReporter } from "./BaseReporter";
import type { FlameGraphReporterOptions } from "./flame-graph/types";
import type { SpanBufferViews } from "./flame-graph/SpanBuffer";

import { flameGraphState } from "./flame-graph/state";
// Import components to ensure registration
import "./flame-graph/FlameGraphToggle";
import "./flame-graph/FlameGraphDialog";

/**
 * FlameGraphReporter renders spans as a flame graph using Web Components.
 * Extends BaseReporter for consistent lifecycle and event handling.
 */
export class FlameGraphReporter extends BaseReporter {
  private depthMap = new Map<string, number>();

  private container: FlameGraphReporterElement | null = null;

  private readonly reporterOptions: Required<
    Omit<FlameGraphReporterOptions, "container">
  > & {
    container?: HTMLElement | string;
  };

  private animationFrameId: number | null = null;
  private unsubs: Array<() => void> = [];

  constructor(options: FlameGraphReporterOptions = {}) {
    super({ useBatching: true });
    this.reporterOptions = {
      zIndex: options.zIndex ?? 9999,
      buttonPosition: options.buttonPosition ?? "bottom-right",
      container: options.container,
    };
  }

  /**
   * Mount the flame graph UI.
   * @param target - Optional element or selector to mount into (overrides constructor option)
   */
  mount(target?: HTMLElement | string): void {
    // If already mounted, unmount first
    if (this.container) {
      this.unmount();
    }

    // Resolve mount target
    const containerOption =
      target ?? this.reporterOptions.container ?? document.body;
    let mountTarget =
      typeof containerOption === "string"
        ? document.querySelector<HTMLElement>(containerOption)
        : containerOption;

    if (!mountTarget) {
      console.warn(
        `[FlameGraphReporter] Container not found: ${containerOption}. Falling back to floating mode.`
      );
      mountTarget = document.body;
    }

    this.container = document.createElement(
      "flame-graph-reporter"
    ) as FlameGraphReporterElement;
    mountTarget.appendChild(this.container);

    this.container.setAttribute(
      "position",
      this.reporterOptions.buttonPosition
    );
  }

  /**
   * Remove the flame graph UI.
   */
  unmount(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.container?.remove();
    flameGraphState.reset();
    this.container = null;
  }

  protected onStop(): void {
    this.clearData();
  }

  protected processEvents(events: TraceEvent[]): void {
    events.forEach((event) => {
      switch (event.kind) {
        case "start":
          this.onSpanStart(event);
          break;
        case "end":
          this.onSpanEnd(event);
          break;
        default:
          break;
      }
    });
  }

  protected onSpanStart(event: SpanStartEvent): void {
    if (!flameGraphState.getState().isRecording) return;
    this.handleSpanStartInternal(event);
  }

  protected onSpanEnd(event: SpanEndEvent): void {
    if (!flameGraphState.getState().isRecording) return;
    this.handleSpanEndInternal(event);
  }

  private handleSpanStartInternal(event: SpanStartEvent): void {
    const parentDepth = event.parentSpan
      ? this.depthMap.get(event.parentSpan.spanId) ?? 0
      : -1;
    const depth = parentDepth + 1;

    this.depthMap.set(event.span.spanId, depth);

    flameGraphState.startSpan({
      spanId: event.span.spanId,
      parentSpanId: event.parentSpan?.spanId ?? null,
      name: event.name,
      startTime: event.timestamp,
      endTime: event.timestamp,
      duration: 0,
      depth,
      status: "running",
      payload: event.payload,
      color: event.span.meta?.color ?? "primary",
    });
  }

  private handleSpanEndInternal(event: SpanEndEvent): void {
    flameGraphState.endSpan(event.span.spanId, event.timestamp, event.status);
  }

  private clearData(): void {
    this.depthMap.clear();
    flameGraphState.clearRecording();
  }

  // Public API
  get recording(): boolean {
    return flameGraphState.getState().isRecording;
  }

  startRecording(): void {
    flameGraphState.startRecording();
    this.depthMap.clear();
  }

  stopRecording(): void {
    flameGraphState.stopRecording();
  }

  clearSpans(): void {
    this.clearData();
  }

  getSpans(): SpanBufferViews {
    return flameGraphState.getState().spanBuffer;
  }

  getSpanBuffer(): SpanBufferViews {
    return flameGraphState.getState().spanBuffer;
  }

  showPanel(): void {
    flameGraphState.open();
  }

  hidePanel(): void {
    flameGraphState.close();
  }
}

class FlameGraphReporterElement extends HTMLElement {
  #shadowRoot = this.attachShadow({ mode: "open" });
  #dialog = document.createElement("flame-graph-dialog");
  #toggle = document.createElement("flame-graph-toggle");

  static get observedAttributes() {
    return ["position"];
  }

  attributeChangedCallback(name: string) {
    if (name === "position") {
      this.#toggle.setAttribute(
        "position",
        this.getAttribute("position") as
          | "bottom-right"
          | "bottom-left"
          | "top-right"
          | "top-left"
      );
    }
  }

  connectedCallback() {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(this.#toggle);
    fragment.appendChild(this.#dialog);
    this.#shadowRoot.appendChild(fragment);
  }
}

customElements.define("flame-graph-reporter", FlameGraphReporterElement);
