import "./FlameGraphResizeHandle";

import { html, render } from "lit-html";

import type { ResizeEventDetail } from "./FlameGraphResizeHandle";

import { drawScheduler } from "./DrawScheduler";
import { flameGraphState, selectors } from "./state";
import { BUTTON_STYLES, formatTime, theme, TYPOGRAPHY_STYLES, HOST_STYLES } from "./styles";
import { css } from "./utilities";

const STYLES = css`
  ${HOST_STYLES()}
  ${BUTTON_STYLES}
  
  :host {
    display: flex;
    flex-direction: column;
    background: ${theme.ui.bgOverlay};
    font-size: 12px;
    color: ${theme.ui.text};
    position: relative;
    font-family: ${theme.family.default};
    box-sizing: border-box;
    overflow: hidden;
  }

  flame-graph-resize-handle {
    position: absolute;
  }

  /* Resize handle positions based on data-position */
  :host([data-position="bottom"]) flame-graph-resize-handle {
    top: 0;
    left: 0;
    right: 0;
  }

  :host([data-position="left"]) flame-graph-resize-handle {
    top: 0;
    right: 0;
    bottom: 0;
  }

  :host([data-position="right"]) flame-graph-resize-handle {
    top: 0;
    left: 0;
    bottom: 0;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 4px 4px 16px;
    background: ${theme.details.headerBg};
    border-bottom: 1px solid ${theme.ui.borderSubtle};
    flex-shrink: 0;
  }

  .title {
    ${TYPOGRAPHY_STYLES({
      fontWeight: theme.weight.bold,
      color: theme.details.labelKey,
    })}
    word-break: break-word;
  }

  .close-btn {
    flex-shrink: 0;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 10px 16px 12px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 8px 16px;
  }

  .item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .label {
    font-size: 10px;
    color: ${theme.ui.textDim};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .value {
    color: ${theme.details.labelKey};
    font-family: ${theme.family.monospace};
  }

  .value.duration {
    color: ${theme.details.spanName};
    font-weight: 500;
  }

  .value.success {
    color: ${theme.accent.success};
  }

  .value.error {
    color: ${theme.details.errorStatus};
  }

  .payload {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid ${theme.ui.border};
  }

  .payload-title {
    font-size: 10px;
    color: ${theme.ui.textDim};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  .payload-content {
    background: ${theme.ui.bgOverlay};
    border-radius: 6px;
    padding: 8px 10px;
    font-family: ${theme.family.monospace};
    font-size: 11px;
    color: ${theme.details.labelValue};
    word-break: break-word;
    white-space: pre-wrap;
  }
`;

export class FlameGraphDetails extends HTMLElement {
  shadowRoot!: ShadowRoot;
  private unsubAbortController = new AbortController();

  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.renderTemplate();
    this.subscribeToState();
  }

  disconnectedCallback() {
    this.unsubAbortController.abort();
  }

  private subscribeToState() {
    flameGraphState.subscribe(
      selectors.detailsPosition,
      () => {
        this.draw();
      },
      { signal: this.unsubAbortController.signal },
    );

    flameGraphState.subscribe(
      selectors.detailsVisible,
      () => {
        this.draw();
      },
      { signal: this.unsubAbortController.signal },
    );

    flameGraphState.subscribe(
      selectors.selectedSpan,
      () => {
        this.draw();
      },
      { signal: this.unsubAbortController.signal },
    );
  }

  private draw() {
    drawScheduler.schedule(() => {
      this.updateContent();
    });
  }

  private renderTemplate() {
    if (!this.shadowRoot) return;
    render(html`<style>${STYLES}</style>`, this.shadowRoot);
    this.updateContent();
  }

  private handleClose = () => {
    flameGraphState.setDetailsVisible(false);
  };

  private handleResize = (e: Event) => {
    const detail = (e as CustomEvent).detail as ResizeEventDetail;
    const layout = selectors.detailsLayout(flameGraphState.getState());
    const position = selectors.detailsPosition(flameGraphState.getState());

    // Delta sign depends on handle position:
    // - details bottom (handle top): drag up = -deltaY = bigger height
    // - details left (handle right): drag right = +deltaX = bigger width
    // - details right (handle left): drag left = -deltaX = bigger width
    const widthDelta = position === "left" ? detail.deltaX : -detail.deltaX;
    const heightDelta = -detail.deltaY;

    flameGraphState.resizeDetails(layout.width + widthDelta, layout.height + heightDelta);
  };

  private updateContent() {
    const span = selectors.selectedSpan(flameGraphState.getState());
    const timeRange = selectors.timeRange(flameGraphState.getState());
    if (!span) return;
    const isPending = span.status === "running";
    const relativeStart = span.startTime !== undefined ? span.startTime - timeRange.minTime : 0;
    const relativeEnd = isPending ? null : (span.endTime as number) - timeRange.minTime;

    const statusText = isPending ? "In Progress" : (span.status ?? "unknown");
    const statusClass = isPending ? "" : span.status === "error" ? "error" : "success";

    const payloadStr =
      span.payload && Object.keys(span.payload).length > 0
        ? JSON.stringify(span.payload, null, 2)
        : null;

    const position = selectors.detailsPosition(flameGraphState.getState());
    const handlePosition = selectors.getHandlePosition(position);

    const template = html`
      <style>${STYLES}</style>
      <flame-graph-resize-handle
        position="${handlePosition}"
        @resize=${this.handleResize}
      ></flame-graph-resize-handle>
      <div class="header">
        <div class="title">${span.name ?? "Unknown"}</div>
        <button class="icon-only close-btn" part="close" @click=${this.handleClose}>✕</button>
      </div>
      <div class="content">
        <div class="grid">
          <div class="item">
            <span class="label">Duration</span>
            <span class="value duration">${isPending ? "–" : formatTime(span.duration as number)}</span>
          </div>
          <div class="item">
            <span class="label">Start</span>
            <span class="value">+${formatTime(relativeStart)}</span>
          </div>
          <div class="item">
            <span class="label">End</span>
            <span class="value">${relativeEnd === null ? "–" : `+${formatTime(relativeEnd)}`}</span>
          </div>
          <div class="item">
            <span class="label">Status</span>
            <span class="value ${statusClass}">${statusText}</span>
          </div>
        </div>
        ${
          payloadStr
            ? html`
            <div class="payload">
              <div class="payload-title">Payload</div>
              <div class="payload-content">${payloadStr}</div>
            </div>
          `
            : ""
        }
      </div>
    `;

    render(template, this.shadowRoot);
  }
}

customElements.define("flame-graph-details", FlameGraphDetails);
