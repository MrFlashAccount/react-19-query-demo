import {
  COLOR_PALETTE,
  SELECTED_BORDER_COLOR,
  CSS_VARS,
  RESET_CASCADE,
} from "./styles";
import type { FlameGraphSpan, ViewState } from "./types";
import { css, getElement, html } from "./utilities";
import { CanvasWorkerClient } from "./canvas-worker";
import { drawScheduler } from "./DrawScheduler";
import { flameGraphState, selectors } from "./state";
import { calculateSpanLayouts, type SpanLayout } from "./LaneCalculator";
import type { SpanId } from "../../types";

const STYLES = css`
  ${CSS_VARS}

  :host {
    ${RESET_CASCADE}

    display: block;
    flex: 1;
    position: relative;
    overflow: hidden;
    cursor: grab;
    min-height: 0;
    contain: content;
  }

  :host(:active) {
    cursor: grabbing;
  }

  canvas {
    all: unset;
    position: absolute;
    top: 0;
    left: 0;
  }

  .empty {
    display: flex;
    flex: none;
    height: 100%;
    width: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--fg-text-dim);
    font-family: var(--fg-font);
  }

  .empty-icon {
    font-size: 32px;
  }
`;

// Constants (must match worker)
const ROW_HEIGHT = 28;
const ROW_GAP = 3;
const MIN_SPAN_WIDTH = 4;
const PADDING_LEFT = 12;
const PADDING_RIGHT = 12;
const PADDING_TOP = 8;
const PAN_MARGIN_PX = 20;

export class FlameGraphCanvas extends HTMLElement {
  public shadowRoot!: ShadowRoot;
  private canvas!: HTMLCanvasElement;
  private canvasWorker!: CanvasWorkerClient;
  private emptyEl!: HTMLElement;

  // Drag state
  private isDragging = false;
  private hasDragged = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartOffsetX = 0;
  private dragStartOffsetY = 0;

  private dpr = window.devicePixelRatio || 1;
  private unmountAbortController = new AbortController();

  // Span layouts for hit testing (mirrors worker's calculation)
  private spanLayouts = new Map<SpanId, SpanLayout>();

  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.setupCanvas();
    this.setupEventListeners();
    this.subscribeToState();
  }

  disconnectedCallback() {
    this.unmountAbortController.abort();
  }

  private subscribeToState() {
    // Subscribe to spans changes - send updateSpans + draw
    flameGraphState.subscribe(
      selectors.spans,
      (spans) => this.updateSpansAndDraw(spans),
      { signal: this.unmountAbortController.signal }
    );
    flameGraphState.subscribe(
      selectors.hasSpans,
      (hasSpans) => {
        this.emptyEl.style.display = hasSpans ? "none" : "flex";
      },
      { signal: this.unmountAbortController.signal }
    );
    flameGraphState.subscribe(selectors.selectedSpan, () => this.draw(), {
      signal: this.unmountAbortController.signal,
    });
    flameGraphState.subscribe(selectors.timeRange, () => this.draw(), {
      signal: this.unmountAbortController.signal,
    });
    // Subscribe to zoom/pan changes for redraw (fine-grained - only zoom/offset)
    flameGraphState.subscribe(selectors.panZoom, () => this.draw(), {
      signal: this.unmountAbortController.signal,
    });
    // Subscribe to calculated layout for canvas dimensions only
    flameGraphState.subscribe(
      selectors.canvasLayout,
      (layout) => this.applyLayoutDimensions(layout.width, layout.height),
      { signal: this.unmountAbortController.signal }
    );
  }

  private applyLayoutDimensions(width: number, height: number) {
    drawScheduler.schedule(() => {
      this.resizeCanvas(width, height);
    });
  }

  private render() {
    if (!this.shadowRoot) return;
    const { width, height } =
      flameGraphState.getState().viewState.calculatedLayout.canvas;
    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <canvas
        width=${width * this.dpr}
        height=${height * this.dpr}
        style="width: ${width}px; height: ${height}px;"
      ></canvas>
      <div class="empty">
        <div class="empty-icon">📈</div>
        <div>No spans recorded yet</div>
        <div style="font-size: 11px;">Click Record to start capturing</div>
      </div>
    `;
    this.emptyEl = getElement(".empty", this.shadowRoot);
  }

  private setupCanvas() {
    if (!this.shadowRoot) return;
    this.canvas = getElement<HTMLCanvasElement>("canvas", this.shadowRoot);

    this.canvasWorker = new CanvasWorkerClient();
    this.unmountAbortController.signal.addEventListener(
      "abort",
      () => {
        this.canvasWorker.terminate();
      },
      { once: true }
    );

    // Transfer canvas control to worker
    const offscreen = this.canvas.transferControlToOffscreen();
    this.canvasWorker.init(
      {
        canvas: offscreen,
        colorPalette: COLOR_PALETTE,
        selectedBorderColor: SELECTED_BORDER_COLOR,
      },
      [offscreen]
    );
  }

  private setupEventListeners() {
    this.addEventListener("pointerdown", this.handlePointerDown, {
      passive: false,
      signal: this.unmountAbortController.signal,
    });

    this.addEventListener("wheel", this.handleWheel, {
      passive: false,
      signal: this.unmountAbortController.signal,
    });

    this.addEventListener("click", this.handleClick, {
      passive: false,
      signal: this.unmountAbortController.signal,
    });

    this.addEventListener("mousemove", this.handleMouseMoveForCursor, {
      passive: false,
      signal: this.unmountAbortController.signal,
    });

    document.addEventListener("pointermove", this.handlePointerMove, {
      passive: false,
      signal: this.unmountAbortController.signal,
    });

    document.addEventListener("pointerup", this.handlePointerUp, {
      passive: false,
      signal: this.unmountAbortController.signal,
    });
  }

  private handleMouseMoveForCursor = (e: MouseEvent) => {
    if (this.isDragging) return;
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const span = this.findSpanAt(x, y);
    this.style.cursor = span ? "pointer" : "grab";
  };

  private handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const { viewState } = flameGraphState.getState();
    this.isDragging = true;
    this.hasDragged = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragStartOffsetX = viewState.offsetX;
    this.dragStartOffsetY = viewState.offsetY;
    this.setPointerCapture(e.pointerId);
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isDragging) return;

    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.hasDragged = true;
    }

    const { viewState } = flameGraphState.getState();
    const newViewState = this.clampViewState({
      ...viewState,
      offsetX: this.dragStartOffsetX + dx,
      offsetY: this.dragStartOffsetY + dy,
    });

    flameGraphState.setViewState(newViewState);
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (this.isDragging) {
      this.releasePointerCapture(e.pointerId);
    }
    this.isDragging = false;
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();

    const rect = selectors.layoutToDOMRect(
      selectors.canvasLayout(flameGraphState.getState())
    );
    const mouseX = e.clientX - rect.left;
    const contentMouseX = mouseX - PADDING_LEFT;

    const zoomFactor = e.deltaY > 0 ? 0.96 : 1.04;
    const availableWidth = rect.width - PADDING_LEFT - PADDING_RIGHT;
    const minZoom = availableWidth / rect.width;
    const maxZoom = 500;

    const { viewState } = flameGraphState.getState();

    // Calculate new zoom (clamped)
    const newZoom = Math.max(
      minZoom,
      Math.min(maxZoom, viewState.zoom * zoomFactor)
    );

    // If zoom didn't change (at limits), don't update offset
    if (Math.abs(newZoom - viewState.zoom) < 0.0001) {
      return;
    }

    const scale = newZoom / viewState.zoom;
    const newOffsetX =
      contentMouseX - (contentMouseX - viewState.offsetX) * scale;

    const newViewState = this.clampViewState({
      ...viewState,
      offsetX: newOffsetX,
      zoom: newZoom,
    });

    flameGraphState.setViewState(newViewState);
  };

  private handleClick = (e: MouseEvent) => {
    if (this.hasDragged) return;

    // Use getBoundingClientRect for viewport-relative coordinates (not cached rect from ResizeObserver)
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedSpan = this.findSpanAt(x, y);
    flameGraphState.selectSpan(clickedSpan?.spanId ?? null);

    this.dispatchEvent(
      new CustomEvent("spanselect", {
        detail: clickedSpan,
        bubbles: true,
      })
    );
  };

  private clampViewState(state: ViewState): ViewState {
    const { width, height } =
      flameGraphState.getState().viewState.calculatedLayout.canvas;
    const { timeRange, spans } = flameGraphState.getState();
    const { minTime, maxTime } = timeRange;
    const totalDuration = maxTime - minTime;

    if (totalDuration === 0 || width === 0) return state;

    const availableWidth = width - PADDING_LEFT - PADDING_RIGHT;
    const minZoom = availableWidth / width;
    const zoom = Math.max(minZoom, Math.min(500, state.zoom));

    const isAtMinZoom = Math.abs(zoom - minZoom) < 0.001;
    if (isAtMinZoom) {
      return { offsetX: 0, offsetY: 0, zoom: minZoom };
    }

    let { offsetX, offsetY } = state;

    const contentWidth = width * zoom;
    const maxOffsetX = PAN_MARGIN_PX;
    const minOffsetX = width - contentWidth - PAN_MARGIN_PX - PADDING_LEFT;
    offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, offsetX));

    // Use max adjusted depth from span layouts for proper scroll limits
    let maxAdjustedDepth = 0;
    for (const span of spans) {
      const layout = this.spanLayouts.get(span.spanId);
      const adjustedDepth = layout?.adjustedDepth ?? span.depth;
      if (adjustedDepth > maxAdjustedDepth) {
        maxAdjustedDepth = adjustedDepth;
      }
    }

    const contentHeight = (maxAdjustedDepth + 1) * (ROW_HEIGHT + ROW_GAP);
    const maxOffsetY = PADDING_TOP;
    const minOffsetY = Math.min(0, height - contentHeight - PADDING_TOP * 2);
    offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, offsetY));

    return { offsetX, offsetY, zoom };
  }

  private resizeCanvas(width: number, height: number) {
    this.executeDraw(width, height);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  private updateSpansAndDraw(spans: FlameGraphSpan[]) {
    // Update span layouts for hit testing
    this.spanLayouts = calculateSpanLayouts(spans);

    drawScheduler.schedule(() => {
      const { width, height } = selectors.canvasLayout(
        flameGraphState.getState()
      );
      const { selectedSpanId, timeRange, viewState } =
        flameGraphState.getState();

      this.canvasWorker
        .batch()
        .updateSpans(spans)
        .draw({
          width,
          height,
          dpr: this.dpr,
          selectedSpanId,
          timeRange,
          viewState,
        })
        .send();
    });
  }

  draw() {
    drawScheduler.schedule(() => {
      const { width, height } = selectors.canvasLayout(
        flameGraphState.getState()
      );
      return this.executeDraw(width, height);
    });
  }

  private executeDraw(width: number, height: number) {
    const { selectedSpanId, timeRange, viewState } = flameGraphState.getState();

    this.canvasWorker.draw({
      width,
      height,
      dpr: this.dpr,
      selectedSpanId,
      timeRange,
      viewState,
    });
  }

  private findSpanAt(x: number, y: number): FlameGraphSpan | null {
    const { viewState, timeRange, spans } = flameGraphState.getState();
    const { width } = viewState.calculatedLayout.canvas;
    const { minTime, maxTime } = timeRange;
    const totalDuration = maxTime - minTime;
    if (totalDuration === 0) return null;

    const { offsetX, offsetY, zoom } = viewState;
    const effectiveOffsetX = offsetX + PADDING_LEFT;
    const effectiveOffsetY = offsetY + PADDING_TOP;

    const timeToX = (time: number) =>
      ((time - minTime) / totalDuration) * width * zoom + effectiveOffsetX;

    const durationToWidth = (duration: number) =>
      (duration / totalDuration) * width * zoom;

    const currentTime = maxTime;

    // Check spans (running spans use currentTime for width)
    // Uses adjusted depths from lane calculator for proper hit testing
    for (let i = spans.length - 1; i >= 0; i--) {
      const span = spans[i];
      const isRunning = span.status === "running";
      const duration = isRunning ? currentTime - span.startTime : span.duration;

      // Use adjusted depth from span layouts
      const layout = this.spanLayouts.get(span.spanId);
      const adjustedDepth = layout?.adjustedDepth ?? span.depth;

      const sx = timeToX(span.startTime);
      const sy = adjustedDepth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;
      const sw = Math.max(durationToWidth(duration), MIN_SPAN_WIDTH);
      const sh = ROW_HEIGHT;

      if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) {
        return span;
      }
    }

    return null;
  }
}

customElements.define("flame-graph-canvas", FlameGraphCanvas);
