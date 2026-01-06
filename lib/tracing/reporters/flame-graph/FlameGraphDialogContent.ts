import { CSS_VARS, ui } from "./styles";
import type { FlameGraphSpan } from "./types";
import { css, getElement, html } from "./utilities";
import { drawScheduler } from "./DrawScheduler";
import { flameGraphState } from "./state";

// Import components to ensure they're registered
import "./FlameGraphTimeline";
import "./FlameGraphCanvas";
import "./FlameGraphDetails";
import type { FlameGraphDetails } from "./FlameGraphDetails";

const STYLES = css`
  :host {
    all: unset;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    width: 100%;
    height: 100%;
    contain: content;
  }

  ${CSS_VARS}

  .body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .status {
    padding: 8px 16px;
    font-size: 11px;
    color: var(--fg-text-muted);
    background: ${ui.bgOverlay};
    border-top: 1px solid var(--fg-border-subtle);
    display: flex;
    justify-content: space-between;
    flex-shrink: 0;
    contain: strict;
    height: 16px;
  }

  flame-graph-timeline {
    flex-shrink: 0;
  }

  flame-graph-canvas {
    flex: 1;
    min-height: 0;
  }
`;

export class FlameGraphDialogContent extends HTMLElement {
  private spansCountEl!: HTMLElement;
  private zoomLevelEl!: HTMLElement;
  private details!: FlameGraphDetails;
  private unsubs: Array<() => void> = [];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.subscribeToState();
  }

  disconnectedCallback() {
    this.unsubs.forEach((u) => u());
  }

  private subscribeToState() {
    // Subscribe to spans/pendingSpans for count display
    this.unsubs.push(
      flameGraphState.subscribe("spans", () => this.updateSpansCount())
    );

    // Subscribe to viewState.zoom for zoom display
    this.unsubs.push(
      flameGraphState.subscribe<number>("viewState.zoom", (zoom) => {
        drawScheduler.schedule(() => {
          if (this.zoomLevelEl) {
            this.zoomLevelEl.textContent = `Zoom: ${Math.round(zoom * 100)}%`;
          }
        });
      })
    );

    // Subscribe to selectedSpanId for details panel
    this.unsubs.push(
      flameGraphState.subscribe<string | null>("selectedSpanId", (spanId) => {
        if (spanId) {
          const span = this.findSpanById(spanId);
          if (span) {
            this.details?.show(span);
          }
        } else {
          this.details?.hide();
        }
      })
    );
  }

  private findSpanById(
    spanId: string
  ): FlameGraphSpan | Partial<FlameGraphSpan> | null {
    const spans = flameGraphState.store.getKey("spans");
    const pendingSpans = flameGraphState.store.getKey("pendingSpans");

    const found = spans.find((s) => s.spanId === spanId);
    if (found) return found;

    return pendingSpans.get(spanId) ?? null;
  }

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <div class="body">
        <flame-graph-timeline></flame-graph-timeline>
        <flame-graph-canvas></flame-graph-canvas>
      </div>
      <flame-graph-details></flame-graph-details>
      <div class="status">
        <span class="spans-count">0 spans</span>
        <span class="zoom-level">Zoom: 100%</span>
      </div>
    `;

    this.spansCountEl = getElement(".spans-count", this.shadowRoot);
    this.zoomLevelEl = getElement(".zoom-level", this.shadowRoot);
    this.details = getElement("flame-graph-details", this.shadowRoot);
  }

  private setupEventListeners() {
    // Details close
    this.details?.addEventListener("close", () => {
      flameGraphState.selectSpan(null);
    });
  }

  private updateSpansCount() {
    const count = flameGraphState.spanCount;
    drawScheduler.schedule(() => {
      if (this.spansCountEl) {
        this.spansCountEl.textContent = `${count} span${
          count !== 1 ? "s" : ""
        }`;
      }
    });
  }
}

customElements.define("flame-graph-dialog-content", FlameGraphDialogContent);
