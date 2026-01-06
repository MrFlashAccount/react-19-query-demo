import { COLOR_PALETTE, SELECTED_BORDER_COLOR, CSS_VARS } from "./styles";
import type { FlameGraphSpan, ViewState } from "./types";
import { css, getElement, html } from "./utilities";
import CanvasWorker from "./canvas.worker?worker";
import type {
  InitMessage,
  ResizeMessage,
  DrawMessage,
  UpdateSpansMessage,
} from "./canvas.worker";
import { drawScheduler } from "./DrawScheduler";
import { flameGraphState } from "./state";

const STYLES = css`
  ${CSS_VARS}

  :host {
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
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--fg-text-dim);
    gap: 8px;
    font-family: var(--fg-font);
  }

  .empty-icon {
    font-size: 32px;
    opacity: 0.5;
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
  private canvas: HTMLCanvasElement | null = null;
  private worker: Worker | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private emptyEl: HTMLElement | null = null;
  private workerReady = false;
  private unsubs: Array<() => void> = [];

  // Canvas dimensions (CSS pixels)
  private canvasWidth = 0;
  private canvasHeight = 0;

  // Drag state
  private isDragging = false;
  private hasDragged = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartOffsetX = 0;
  private dragStartOffsetY = 0;

  private dpr = window.devicePixelRatio || 1;
  private rect!: DOMRectReadOnly;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.setupCanvas();
    this.setupEventListeners();
    this.subscribeToState();
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.worker?.terminate();
    document.removeEventListener("pointermove", this.handlePointerMove);
    document.removeEventListener("pointerup", this.handlePointerUp);
    this.unsubs.forEach((u) => u());
  }

  private subscribeToState() {
    // Subscribe to spans changes
    this.unsubs.push(
      flameGraphState.subscribe<FlameGraphSpan[]>("spans", (spans) => {
        if (this.worker && this.workerReady) {
          this.worker.postMessage({
            type: "updateSpans",
            spans,
          } satisfies UpdateSpansMessage);
        }
        this.draw();
      })
    );

    // Subscribe to other state changes that trigger draw
    this.unsubs.push(
      flameGraphState.subscribe("pendingSpans", () => this.draw())
    );
    this.unsubs.push(
      flameGraphState.subscribe("selectedSpanId", () => this.draw())
    );
    this.unsubs.push(flameGraphState.subscribe("timeRange", () => this.draw()));
    this.unsubs.push(flameGraphState.subscribe("viewState", () => this.draw()));
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <canvas></canvas>
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

    // Create worker using Vite's ?worker import
    this.worker = new CanvasWorker();

    // Transfer canvas control to worker
    const offscreen = this.canvas.transferControlToOffscreen();
    this.worker.postMessage(
      {
        type: "init",
        canvas: offscreen,
        colorPalette: COLOR_PALETTE,
        selectedBorderColor: SELECTED_BORDER_COLOR,
      } satisfies InitMessage,
      [offscreen]
    );
    this.workerReady = true;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this) {
          drawScheduler.schedule(() => {
            this.resizeCanvas(entry.contentRect);
          });
        }
      }
    });
    this.rect = this.getBoundingClientRect();
    this.resizeObserver.observe(this);
    this.resizeCanvas(this.rect);
  }

  private setupEventListeners() {
    this.addEventListener("pointerdown", this.handlePointerDown);
    this.addEventListener("wheel", this.handleWheel, { passive: false });
    this.addEventListener("click", this.handleClick);
    this.addEventListener("mousemove", this.handleMouseMoveForCursor);

    document.addEventListener("pointermove", this.handlePointerMove);
    document.addEventListener("pointerup", this.handlePointerUp);
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
    const viewState = flameGraphState.store.getKey("viewState");
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

    const viewState = flameGraphState.store.getKey("viewState");
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

    const rect = this.rect;
    const mouseX = e.clientX - rect.left;
    const contentMouseX = mouseX - PADDING_LEFT;

    const zoomFactor = e.deltaY > 0 ? 0.96 : 1.04;
    const availableWidth = rect.width - PADDING_LEFT - PADDING_RIGHT;
    const minZoom = availableWidth / rect.width;
    const maxZoom = 500;

    const viewState = flameGraphState.store.getKey("viewState");

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
    const width = this.canvasWidth;
    const height = this.canvasHeight;
    const timeRange = flameGraphState.store.getKey("timeRange");
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

    const maxDepth = flameGraphState.maxDepth;

    const contentHeight = (maxDepth + 1) * (ROW_HEIGHT + ROW_GAP);
    const maxOffsetY = PADDING_TOP;
    const minOffsetY = Math.min(0, height - contentHeight - PADDING_TOP * 2);
    offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, offsetY));

    return { offsetX, offsetY, zoom };
  }

  private resizeCanvas(rect: DOMRectReadOnly) {
    if (!this.canvas || !this.worker) return;

    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;
    this.rect = rect;

    drawScheduler.schedule(() => {
      if (!this.canvas || !this.worker) return;

      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;

      this.worker.postMessage({
        type: "resize",
        width: rect.width,
        height: rect.height,
        dpr: this.dpr,
      } satisfies ResizeMessage);

      this.executeDraw();
    });
  }

  draw() {
    drawScheduler.schedule(() => this.executeDraw());
  }

  private executeDraw() {
    if (!this.worker || !this.workerReady) return;

    const spans = flameGraphState.store.getKey("spans");
    const pendingSpans = flameGraphState.store.getKey("pendingSpans");
    const selectedSpanId = flameGraphState.store.getKey("selectedSpanId");
    const timeRange = flameGraphState.store.getKey("timeRange");
    const viewState = flameGraphState.store.getKey("viewState");

    const hasSpans = spans.length > 0 || pendingSpans.size > 0;
    if (this.emptyEl) {
      this.emptyEl.style.display = hasSpans ? "none" : "flex";
    }

    // Convert Map to array for transfer
    const pendingSpansArray = Array.from(pendingSpans.entries());

    // Note: spans are sent separately via updateSpans for efficient indexing
    this.worker.postMessage({
      type: "draw",
      width: this.canvasWidth,
      height: this.canvasHeight,
      dpr: this.dpr,
      pendingSpans: pendingSpansArray,
      selectedSpanId,
      timeRange,
      viewState,
    } satisfies DrawMessage);
  }

  private findSpanAt(
    x: number,
    y: number
  ): FlameGraphSpan | Partial<FlameGraphSpan> | null {
    const width = this.canvasWidth;
    const timeRange = flameGraphState.store.getKey("timeRange");
    const { minTime, maxTime } = timeRange;
    const totalDuration = maxTime - minTime;
    if (totalDuration === 0) return null;

    const viewState = flameGraphState.store.getKey("viewState");
    const { offsetX, offsetY, zoom } = viewState;
    const effectiveOffsetX = offsetX + PADDING_LEFT;
    const effectiveOffsetY = offsetY + PADDING_TOP;

    const timeToX = (time: number) =>
      ((time - minTime) / totalDuration) * width * zoom + effectiveOffsetX;

    const durationToWidth = (duration: number) =>
      (duration / totalDuration) * width * zoom;

    const spans = flameGraphState.store.getKey("spans");
    const pendingSpans = flameGraphState.store.getKey("pendingSpans");

    const currentTime = performance.now();
    const completedSpanIds = new Set(spans.map((s) => s.spanId));

    // Check pending spans first (they render on top)
    for (const [spanId, pending] of pendingSpans) {
      if (completedSpanIds.has(spanId)) continue;
      if (pending.startTime === undefined || pending.depth === undefined)
        continue;

      const sx = timeToX(pending.startTime);
      const sy = pending.depth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;
      const sw = Math.max(
        durationToWidth(currentTime - pending.startTime),
        MIN_SPAN_WIDTH
      );
      const sh = ROW_HEIGHT;

      if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) {
        return pending;
      }
    }

    // Check completed spans
    for (let i = spans.length - 1; i >= 0; i--) {
      const span = spans[i];
      const sx = timeToX(span.startTime);
      const sy = span.depth * (ROW_HEIGHT + ROW_GAP) + effectiveOffsetY;
      const sw = Math.max(durationToWidth(span.duration), MIN_SPAN_WIDTH);
      const sh = ROW_HEIGHT;

      if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) {
        return span;
      }
    }

    return null;
  }
}

customElements.define("flame-graph-canvas", FlameGraphCanvas);
