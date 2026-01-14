import type { SpanStartEvent, SpanEndEvent } from "../../types";
import { BaseReporter } from "../BaseReporter";
import type { FlameGraphSpan, FlameGraphReporterOptions } from "./types";

// Import components to ensure registration
import "./FlameGraphToggle";
import "./FlameGraphDialog";

import type { FlameGraphToggle } from "./FlameGraphToggle";
import type { FlameGraphDialog } from "./FlameGraphDialog";
import { flameGraphState, selectors } from "./state";

/**
 * FlameGraphReporter renders spans as a flame graph using Web Components.
 * Extends BaseReporter for consistent lifecycle and event handling.
 */
export class FlameGraphReporter extends BaseReporter {
  private depthMap = new Map<string, number>();

  // Web components
  private toggleButton: FlameGraphToggle | null = null;
  private dialog: FlameGraphDialog | null = null;
  private container: DocumentFragment | null = null;

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

    this.container = document.createDocumentFragment();

    // Create dialog
    this.dialog = document.createElement(
      "flame-graph-dialog"
    ) as FlameGraphDialog;
    this.container.appendChild(this.dialog);

    this.toggleButton = document.createElement(
      "flame-graph-toggle"
    ) as FlameGraphToggle;
    this.toggleButton.setAttribute(
      "position",
      this.reporterOptions.buttonPosition
    );
    this.setupToggleEvents();
    this.container.appendChild(this.toggleButton);

    // Subscribe to state
    this.subscribeToState();

    // Mount
    mountTarget.appendChild(this.container);
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
    this.container?.childNodes.forEach((child) => {
      child.remove();
    });
    flameGraphState.reset();
    this.container = null;
    this.toggleButton = null;
    this.dialog = null;
  }

  protected onStop(): void {
    this.clearData();
  }

  protected onSpanStart(event: SpanStartEvent): void {
    if (!flameGraphState.getState().isRecording) return;
    this.handleSpanStartInternal(event);
  }

  protected onSpanEnd(event: SpanEndEvent): void {
    if (!flameGraphState.getState().isRecording) return;
    this.handleSpanEndInternal(event);
  }

  private subscribeToState(): void {
    // Sync toggle button with recording state
    this.unsubs.push(
      flameGraphState.subscribe(selectors.isRecording, (isRecording) => {
        if (this.toggleButton) {
          this.toggleButton.recording = isRecording;
        }
      })
    );
  }

  private setupToggleEvents(): void {
    this.toggleButton?.addEventListener("toggle", () => {
      if (flameGraphState.getState().isOpen) {
        flameGraphState.close();
      } else {
        flameGraphState.open();
      }
    });
  }

  private handleSpanStartInternal(event: SpanStartEvent): void {
    const parentDepth = event.parentSpan
      ? this.depthMap.get(event.parentSpan.spanId) ?? 0
      : -1;
    const depth = parentDepth + 1;

    this.depthMap.set(event.span.spanId, depth);

    flameGraphState.startSpan({
      spanId: event.span.spanId,
      parentSpanId: event.parentSpan?.spanId,
      name: event.name,
      startTime: event.timestamp,
      endTime: event.timestamp,
      duration: 0,
      depth,
      payload: event.payload,
      color: event.span.meta?.color,
    });

    this.updateTimeRange();
  }

  private handleSpanEndInternal(event: SpanEndEvent): void {
    flameGraphState.endSpan(event.span.spanId, event.timestamp, event.status);
    this.updateTimeRange();
  }

  private updateTimeRange(): void {
    const { spans } = flameGraphState.getState();

    if (spans.length === 0) {
      flameGraphState.setTimeRange({ minTime: 0, maxTime: 0 });
      return;
    }

    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const span of spans) {
      minTime = Math.min(minTime, span.startTime);
      // For running spans, use current time as maxTime
      const spanEnd =
        span.status === "running" ? performance.now() : span.endTime;
      maxTime = Math.max(maxTime, spanEnd);
    }

    flameGraphState.setTimeRange({ minTime, maxTime });
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

  getSpans(): readonly FlameGraphSpan[] {
    return flameGraphState.getState().spans;
  }

  showPanel(): void {
    flameGraphState.open();
  }

  hidePanel(): void {
    flameGraphState.close();
  }
}
