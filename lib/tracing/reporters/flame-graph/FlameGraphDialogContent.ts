import { CSS_VARS, BUTTON_STYLES, ui, HOST_STYLES } from "./styles";
import type { GridConfig, Position } from "./types";
import { css, getElement, html } from "./utilities";
import { drawScheduler } from "./DrawScheduler";
import { flameGraphState, selectors } from "./state";

// Import components to ensure they're registered
import "./FlameGraphTimeline";
import "./FlameGraphCanvas";
import "./FlameGraphDetails";
import "./FlameGraphRecordButton";
import "./FlameGraphClearButton";

const STYLES = css`
  ${CSS_VARS}
  ${BUTTON_STYLES}
  ${HOST_STYLES}

  :host {
    all: unset;
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .grid-container {
    display: grid;
    width: 100%;
    height: 100%;
  }

  /* Grid area assignments */
  .header-area {
    grid-area: header;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 0 16px;
    background: ${ui.surfaceActive};
    border-bottom: 1px solid var(--fg-border);
    box-sizing: border-box;
    overflow: hidden;
  }

  flame-graph-timeline {
    grid-area: timeline;
  }

  flame-graph-canvas {
    grid-area: canvas;
    overflow: hidden;
  }

  flame-graph-details {
    grid-area: details;
  }

  .statusbar-area {
    grid-area: statusbar;
    padding: 0 16px;
    font-size: 11px;
    color: var(--fg-text-muted);
    background: ${ui.bgOverlay};
    border-top: 1px solid var(--fg-border-subtle);
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;
    overflow: hidden;
  }

  .title {
    font-size: 14px;
    font-weight: 600;
    color: var(--fg-text);
    display: flex;
    align-items: center;
    gap: 8px;
    text-box-trim: trim-both;
  }

  .controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .details-position-controls {
    display: flex;
    gap: 4px;
    margin-right: 12px;
  }

  .details-position-btn {
    padding: 2px 6px;
    font-size: 10px;
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--fg-border-subtle);
    border-radius: 4px;
    color: var(--fg-text-dim);
  }

  .details-position-btn:hover {
    background: var(--fg-surface-hover);
    color: var(--fg-text);
  }
`;

export class FlameGraphDialogContent extends HTMLElement {
  private gridContainer!: HTMLElement;
  private spansCountEl!: HTMLElement;
  private zoomLevelEl!: HTMLElement;
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
    // Subscribe to spans for count display
    this.unsubs.push(
      flameGraphState.subscribe(selectors.spans, (spans) => {
        this.updateSpansCount(spans.length);
      })
    );

    // Subscribe to viewState.zoom for zoom display
    this.unsubs.push(
      flameGraphState.subscribe(selectors.zoom, (zoom) => {
        drawScheduler.schedule(() => {
          if (this.zoomLevelEl) {
            this.zoomLevelEl.textContent = `Zoom: ${Math.round(zoom * 100)}%`;
          }
        });
      })
    );

    // Single subscription to calculated layout - applies all sizing
    this.unsubs.push(
      flameGraphState.subscribe(selectors.gridLayout, (layout) => {
        this.applyLayout(layout);
      })
    );
  }

  /**
   * Apply calculated layout to all components.
   * This is the single place where all sizing happens.
   */
  private applyLayout(layout: GridConfig) {
    drawScheduler.schedule(() => {
      const gridLayoutCSS = this.getGridLayoutAsCSS(layout);
      this.gridContainer.style.gridTemplateAreas =
        gridLayoutCSS.gridTemplateAreas;
      this.gridContainer.style.gridTemplateColumns =
        gridLayoutCSS.gridTemplateColumns;
      this.gridContainer.style.gridTemplateRows =
        gridLayoutCSS.gridTemplateRows;
    });
  }

  private render() {
    if (!this.shadowRoot) return;

    const gridLayout = selectors.gridLayout(flameGraphState.getState());
    const gridCSS = this.getGridLayoutAsCSS(gridLayout);

    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <div
        class="grid-container"
        style="grid-template-areas: ${gridCSS.gridTemplateAreas}; grid-template-columns: ${gridCSS.gridTemplateColumns}; grid-template-rows: ${gridCSS.gridTemplateRows};"
      >
        <div class="header-area">
          <div class="title" id="flame-graph-dialog-title">🔥 Flame Graph</div>
          <div class="controls">
            <flame-graph-record-button></flame-graph-record-button>
            <flame-graph-clear-button></flame-graph-clear-button>
            <button
              class="position-btn"
              data-dialog-position="bottom"
              title="Panel: Bottom"
            >
              ⬇
            </button>
            <button
              class="position-btn"
              data-dialog-position="left"
              title="Panel: Left"
            >
              ⬅
            </button>
            <button
              class="position-btn"
              data-dialog-position="right"
              title="Panel: Right"
            >
              ➡
            </button>
            <button class="icon-only" data-action="close" title="Close">
              ✕
            </button>
          </div>
        </div>
        <flame-graph-timeline></flame-graph-timeline>
        <flame-graph-canvas></flame-graph-canvas>
        <flame-graph-details></flame-graph-details>

        <div class="statusbar-area">
          <span class="spans-count">0 spans</span>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="details-position-controls">
              <button
                class="details-position-btn"
                data-details-position="bottom"
                title="Details: Bottom"
              >
                ⬇
              </button>
              <button
                class="details-position-btn"
                data-details-position="left"
                title="Details: Left"
              >
                ⬅
              </button>
              <button
                class="details-position-btn"
                data-details-position="right"
                title="Details: Right"
              >
                ➡
              </button>
            </div>
            <span class="zoom-level">Zoom: 100%</span>
          </div>
        </div>
      </div>
    `;

    this.gridContainer = getElement(".grid-container", this.shadowRoot);
    this.spansCountEl = getElement(".spans-count", this.shadowRoot);
    this.zoomLevelEl = getElement(".zoom-level", this.shadowRoot);
  }

  private setupEventListeners() {
    // All button clicks
    this.shadowRoot?.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      // Details position buttons
      const detailsBtn = target.closest(
        "[data-details-position]"
      ) as HTMLElement;
      if (detailsBtn) {
        const position = detailsBtn.dataset.detailsPosition as Position;
        flameGraphState.setDetailsPosition(position);
        return;
      }

      // Dialog position buttons
      const dialogBtn = target.closest("[data-dialog-position]") as HTMLElement;
      if (dialogBtn) {
        const position = dialogBtn.dataset.dialogPosition as Position;
        flameGraphState.setDialogPosition(position);
        return;
      }

      // Close button
      const actionBtn = target.closest("[data-action]") as HTMLElement;
      if (actionBtn?.dataset.action === "close") {
        flameGraphState.close();
        return;
      }
    });
  }

  private updateSpansCount(count: number) {
    drawScheduler.schedule(() => {
      if (this.spansCountEl) {
        this.spansCountEl.textContent = `${count} span${
          count !== 1 ? "s" : ""
        }`;
      }
    });
  }

  private getGridLayoutAsCSS(layout: GridConfig) {
    return {
      gridTemplateAreas: layout.templateAreas,
      gridTemplateColumns: layout.templateColumns
        .map((v) => `${v}px`)
        .join(" "),
      gridTemplateRows: layout.templateRows.map((v) => `${v}px`).join(" "),
    };
  }
}

customElements.define("flame-graph-dialog-content", FlameGraphDialogContent);
