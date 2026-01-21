import { HOST_STYLES } from "./styles";
import { css, getElement, html } from "./utilities";
import TimelineWorker from "./timeline.worker?worker";
import type { InitMessage, DrawMessage } from "./timeline.worker";
import { drawScheduler } from "./DrawScheduler";
import { flameGraphState, selectors } from "./state";
import type { TimeRange } from "./types";

const STYLES = css`
  ${HOST_STYLES()}

  :host {
    display: block;
    width: 100%;
    height: 100%;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
`;

export class FlameGraphTimeline extends HTMLElement {
  public shadowRoot!: ShadowRoot;
  private canvas!: HTMLCanvasElement;
  private worker: Worker | null = null;
  private workerReady = false;
  private unsubs: Array<() => void> = [];
  private dpr = window.devicePixelRatio || 1;

  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.setupCanvas();
    this.subscribeToState();
  }

  disconnectedCallback() {
    this.worker?.terminate();
    this.unsubs.forEach((u) => u());
  }

  private subscribeToState() {
    this.unsubs.push(
      flameGraphState.subscribe(selectors.timeRange, () => this.draw())
    );
    // Fine-grained: only zoom/offset changes, not all viewState changes
    this.unsubs.push(
      flameGraphState.subscribe(selectors.panZoom, () => this.draw())
    );
    this.unsubs.push(
      flameGraphState.subscribe(selectors.timelineLayout, () =>
        this.resizeCanvas()
      )
    );
    // Also subscribe to canvas layout since timeline height depends on it
    this.unsubs.push(
      flameGraphState.subscribe(selectors.canvasLayout, () =>
        this.resizeCanvas()
      )
    );
  }

  private render() {
    if (!this.shadowRoot) {
      throw new Error("Shadow root not found");
    }

    const { width, height } = selectors.timelineLayout(
      flameGraphState.getState()
    );
    const dpr = window.devicePixelRatio || 1;
    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <canvas width=${width * dpr} height=${height * dpr}></canvas>
    `;
  }

  private setupCanvas() {
    this.canvas = getElement("canvas", this.shadowRoot);
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
  }

  private resizeCanvas() {
    drawScheduler.schedule(() => {
      if (this.worker === null) return;

      const { width, height } = selectors.timelineLayout(
        flameGraphState.getState()
      );
      const timeRange = selectors.timeRange(flameGraphState.getState());
      const offsetX = selectors.offsetX(flameGraphState.getState());
      const zoom = selectors.zoom(flameGraphState.getState());

      this.executeDraw(width, height, timeRange, offsetX, zoom);
    });
  }

  draw() {
    drawScheduler.schedule(() => {
      const { width, height } = selectors.timelineLayout(
        flameGraphState.getState()
      );
      const offsetX = selectors.offsetX(flameGraphState.getState());
      const zoom = selectors.zoom(flameGraphState.getState());
      const timeRange = selectors.timeRange(flameGraphState.getState());
      return this.executeDraw(width, height, timeRange, offsetX, zoom);
    });
  }

  private executeDraw(
    width: number,
    height: number,
    timeRange: TimeRange,
    offsetX: number,
    zoom: number
  ) {
    if (!this.worker || !this.workerReady) return;

    this.worker.postMessage({
      type: "draw",
      width,
      height,
      dpr: this.dpr,
      timeRange,
      offsetX,
      zoom,
    } satisfies DrawMessage);
  }
}

customElements.define("flame-graph-timeline", FlameGraphTimeline);
