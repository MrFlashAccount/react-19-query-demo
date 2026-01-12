import { CSS_VARS } from "./styles";
import { css, html } from "./utilities";
import TimelineWorker from "./timeline.worker?worker";
import type {
  InitMessage,
  ResizeMessage,
  DrawMessage,
} from "./timeline.worker";
import { drawScheduler } from "./DrawScheduler";
import { flameGraphState, selectors } from "./state";

const STYLES = css`
  ${CSS_VARS}

  :host {
    display: block;
    height: 28px;
    flex-shrink: 0;
    background: var(--fg-bg-overlay);
    border-bottom: 1px solid var(--fg-border-subtle);
    position: relative;
    contain: content;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
`;

export class FlameGraphTimeline extends HTMLElement {
  private canvas: HTMLCanvasElement | null = null;
  private worker: Worker | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private workerReady = false;
  private unsubs: Array<() => void> = [];

  // Canvas dimensions (CSS pixels)
  private canvasWidth = 0;
  private canvasHeight = 0;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.setupCanvas();
    this.subscribeToState();
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.worker?.terminate();
    this.unsubs.forEach((u) => u());
  }

  private subscribeToState() {
    this.unsubs.push(
      flameGraphState.subscribe(selectors.timeRange, () => this.draw())
    );
    this.unsubs.push(
      flameGraphState.subscribe(selectors.viewState, () => this.draw())
    );
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <canvas></canvas>
    `;
  }

  private setupCanvas() {
    this.canvas = this.shadowRoot?.querySelector("canvas") ?? null;
    if (!this.canvas) return;

    // Create worker using Vite's ?worker import
    this.worker = new TimelineWorker();

    // Transfer canvas control to worker
    const offscreen = this.canvas.transferControlToOffscreen();
    this.worker.postMessage(
      { type: "init", canvas: offscreen } satisfies InitMessage,
      [offscreen]
    );
    this.workerReady = true;

    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this);

    this.resizeCanvas();
  }

  private resizeCanvas() {
    if (!this.canvas || !this.worker) return;

    const rect = this.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;

    drawScheduler.schedule(() => {
      if (!this.canvas || !this.worker) return;

      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;

      this.worker.postMessage({
        type: "resize",
        width: rect.width,
        height: rect.height,
        dpr,
      } satisfies ResizeMessage);

      this.executeDraw();
    });
  }

  draw() {
    drawScheduler.schedule(() => this.executeDraw());
  }

  private executeDraw() {
    if (!this.worker || !this.workerReady) return;

    const { timeRange, viewState } = flameGraphState.getState();

    this.worker.postMessage({
      type: "draw",
      width: this.canvasWidth,
      height: this.canvasHeight,
      dpr: window.devicePixelRatio || 1,
      timeRange,
      viewState,
    } satisfies DrawMessage);
  }
}

customElements.define("flame-graph-timeline", FlameGraphTimeline);
