import {
  COLOR_PALETTE,
  SELECTED_BORDER_COLOR,
  RESET_CASCADE,
  theme,
} from "./styles";
import {
  CANVAS_PADDING_LEFT,
  CANVAS_PADDING_RIGHT,
  CANVAS_PAN_MARGIN_PX,
  type ViewState,
} from "./types";
import type { SpanBufferViews, SpanBufferDescriptor } from "./SpanBuffer";
import { getSpansCount, readSpanId } from "./SpanBuffer";
import { css, getElement, html } from "./utilities";
import { CanvasWorkerClient } from "./canvas-worker";
import { drawScheduler } from "./DrawScheduler";
import { flameGraphState, selectors } from "./state";
import { calculateSpanLayouts } from "./LaneCalculator";

const STYLES = css`
  :host {
    ${RESET_CASCADE}

    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    cursor: grab;
    contain: content;
  }

  :host(:active) {
    cursor: grabbing;
  }

  canvas {
    all: unset;
    display: block;
    width: 100%;
    height: 100%;
  }

  .empty {
    display: flex;
    flex: none;
    height: 100%;
    width: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: ${theme.ui.textDim};
    font-family: ${theme.family.default};
  }

  .empty-icon {
    font-size: 32px;
  }
`;

// Constants (must match worker)
const ROW_HEIGHT = 28;
const ROW_GAP = 3;
const MIN_SPAN_WIDTH = 4;
const PADDING_TOP = 8;

// Aliases for imported constants
const PADDING_LEFT = CANVAS_PADDING_LEFT;
const PADDING_RIGHT = CANVAS_PADDING_RIGHT;
const PAN_MARGIN_PX = CANVAS_PAN_MARGIN_PX;

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
  private spanLayouts: Int32Array<ArrayBufferLike> = new Int32Array(0);
  private spanLayoutsCount = 0;

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
      (state) => ({
        spanBuffer: state.spanBuffer,
        spanVersion: state.spanVersion,
      }),
      ({ spanBuffer, spanVersion }) => {
        this.updateSpansAndDraw(spanBuffer, spanVersion);
      },
      { signal: this.unmountAbortController.signal, fireImmediately: true }
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
      <canvas width=${width * this.dpr} height=${height * this.dpr}></canvas>
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
        spanBuffer: {
          sab: flameGraphState.getState().spanBuffer.sab,
          stringSab: flameGraphState.getState().spanBuffer.stringSab,
        },
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
    const spanIndex = this.findSpanAt(x, y);
    this.style.cursor = spanIndex !== null ? "pointer" : "grab";
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

    const state = flameGraphState.getState();
    const rect = selectors.layoutToDOMRect(selectors.canvasLayout(state));
    const mouseX = e.clientX - rect.left;
    const focusX = mouseX - PADDING_LEFT;
    const zoomFactor = e.deltaY > 0 ? 0.96 : 1.04;

    flameGraphState.applyZoom(zoomFactor, focusX);
  };

  private handleClick = (e: MouseEvent) => {
    if (this.hasDragged) return;

    // Use getBoundingClientRect for viewport-relative coordinates (not cached rect from ResizeObserver)
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedIndex = this.findSpanAt(x, y);
    flameGraphState.selectSpan(clickedIndex ?? null);

    this.dispatchEvent(
      new CustomEvent("spanselect", {
        detail:
          clickedIndex == null
            ? null
            : {
                index: clickedIndex,
                spanId: readSpanId(
                  flameGraphState.getState().spanBuffer,
                  clickedIndex
                ),
              },
        bubbles: true,
      })
    );
  };

  private clampViewState(state: ViewState): ViewState {
    const globalState = flameGraphState.getState();
    const { width, height } = globalState.viewState.calculatedLayout.canvas;
    const { spanBuffer, spansCount } = globalState;
    const totalDuration = selectors.totalDuration(globalState);

    if (totalDuration === 0 || width === 0) return state;

    const availableWidth = width - PADDING_LEFT - PADDING_RIGHT;
    const minZoom = availableWidth / width;
    const maxZoom = selectors.maxZoom(globalState);
    const zoom = Math.max(minZoom, Math.min(maxZoom, state.zoom));

    const isAtMinZoom = Math.abs(zoom - minZoom) < 0.001;

    let { offsetX, offsetY } = state;

    // At min zoom, lock horizontal offset; otherwise clamp to pan bounds
    if (isAtMinZoom) {
      offsetX = 0;
    } else {
      const contentWidth = width * zoom;
      const maxOffsetX = PAN_MARGIN_PX;
      const minOffsetX = width - contentWidth - PAN_MARGIN_PX - PADDING_LEFT;
      offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, offsetX));
    }

    // Use max adjusted depth from span layouts for proper scroll limits
    let maxAdjustedDepth = 0;
    for (let i = 0; i < spansCount; i++) {
      const adjustedDepth =
        i < this.spanLayoutsCount ? this.spanLayouts[i] : spanBuffer.depth[i];
      if (adjustedDepth > maxAdjustedDepth) {
        maxAdjustedDepth = adjustedDepth;
      }
    }

    const contentHeight = (maxAdjustedDepth + 1) * (ROW_HEIGHT + ROW_GAP);
    const maxOffsetY = PADDING_TOP;
    const minOffsetY = Math.min(0, height - contentHeight - PADDING_TOP * 2);
    offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, offsetY));

    return { offsetX, offsetY, zoom: isAtMinZoom ? minZoom : zoom };
  }

  private resizeCanvas(width: number, height: number) {
    this.executeDraw(width, height);
  }

  private updateSpansAndDraw(spanBuffer: SpanBufferViews, version: number) {
    const count = getSpansCount(spanBuffer);
    const layouts = calculateSpanLayouts(spanBuffer, count);
    this.spanLayouts = layouts.adjustedDepths;
    this.spanLayoutsCount = layouts.count;

    drawScheduler.schedule(() => {
      const { width, height } = selectors.canvasLayout(
        flameGraphState.getState()
      );
      const { selectedSpanIndex, viewState, spanBuffer } =
        flameGraphState.getState();
      const timeRange = selectors.timeRange(flameGraphState.getState());
      const selectedSpanId =
        selectedSpanIndex == null
          ? null
          : readSpanId(spanBuffer, selectedSpanIndex);

      const bufferDescriptor: SpanBufferDescriptor = {
        sab: spanBuffer.sab,
        stringSab: spanBuffer.stringSab,
      };
      this.canvasWorker
        .batch()
        .updateSpans(bufferDescriptor, version)
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
    const { selectedSpanIndex, viewState, spanBuffer } =
      flameGraphState.getState();
    const timeRange = selectors.timeRange(flameGraphState.getState());
    const selectedSpanId =
      selectedSpanIndex == null
        ? null
        : readSpanId(spanBuffer, selectedSpanIndex);

    this.canvasWorker.draw({
      width,
      height,
      dpr: this.dpr,
      selectedSpanId,
      timeRange: {
        minTime: timeRange.minTime,
        maxTime: timeRange.maxTime,
      },
      viewState: {
        offsetX: viewState.offsetX,
        offsetY: viewState.offsetY,
        zoom: viewState.zoom,
      },
    });
  }

  private findSpanAt(x: number, y: number): number | null {
    const { viewState, spanBuffer, spansCount } = flameGraphState.getState();
    const { width } = viewState.calculatedLayout.canvas;
    const { minTime, maxTime } = selectors.timeRange(
      flameGraphState.getState()
    );
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
    for (let i = spansCount - 1; i >= 0; i--) {
      const isRunning = spanBuffer.status[i] === 1;
      const duration = isRunning
        ? currentTime - spanBuffer.startTime[i]
        : spanBuffer.endTime[i] - spanBuffer.startTime[i];

      // Use adjusted depth from span layouts
      const adjustedDepth =
        i < this.spanLayoutsCount ? this.spanLayouts[i] : spanBuffer.depth[i];

      const sx = timeToX(spanBuffer.startTime[i]);
      const sy = adjustedDepth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;
      const sw = Math.max(durationToWidth(duration), MIN_SPAN_WIDTH);
      const sh = ROW_HEIGHT;

      if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) {
        return i;
      }
    }

    return null;
  }
}

customElements.define("flame-graph-canvas", FlameGraphCanvas);
