import {
  BUTTON_STYLES,
  formatTime,
  escapeHtml,
  details,
  TYPOGRAPHY_STYLES,
  HOST_STYLES,
} from "./styles";
import type { ResizeEventDetail } from "./FlameGraphResizeHandle";
import "./FlameGraphResizeHandle";
import { css, getElement, html } from "./utilities";
import { flameGraphState, selectors } from "./state";

const STYLES = css`
  ${HOST_STYLES}
  ${BUTTON_STYLES}
  
  :host {
    display: flex;
    flex-direction: column;
    background: var(--fg-bg-overlay);
    font-size: 12px;
    color: var(--fg-text);
    position: relative;
    font-family: var(--fg-font);
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
    background: ${details.headerBg};
    border-bottom: 1px solid var(--fg-border-subtle);
    flex-shrink: 0;
  }

  .title {
    ${TYPOGRAPHY_STYLES}
    font-size: 14px;
    font-weight: 600;
    color: ${details.labelKey};
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
    color: var(--fg-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .value {
    color: ${details.labelKey};
    font-family: var(--fg-font-mono);
  }

  .value.duration {
    color: ${details.spanName};
    font-weight: 500;
  }

  .value.success {
    color: var(--fg-success);
  }

  .value.error {
    color: ${details.errorStatus};
  }

  .payload {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--fg-border);
  }

  .payload-title {
    font-size: 10px;
    color: var(--fg-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  .payload-content {
    background: var(--fg-bg-overlay);
    border-radius: 6px;
    padding: 8px 10px;
    font-family: var(--fg-font-mono);
    font-size: 11px;
    color: ${details.labelValue};
    word-break: break-word;
    white-space: pre-wrap;
  }
`;

export class FlameGraphDetails extends HTMLElement {
  shadowRoot!: ShadowRoot;
  private resizeHandle!: HTMLElement;
  private unsubAbortController = new AbortController();

  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.subscribeToState();
  }

  disconnectedCallback() {
    this.unsubAbortController.abort();
  }

  private subscribeToState() {
    flameGraphState.subscribe(
      selectors.detailsLayout,
      () => {
        this.updateContent();
      },
      { signal: this.unsubAbortController.signal }
    );

    flameGraphState.subscribe(
      selectors.detailsPosition,
      () => {
        this.updateContent();
      },
      {
        signal: this.unsubAbortController.signal,
      }
    );

    flameGraphState.subscribe(
      selectors.detailsVisible,
      () => {
        this.updateContent();
      },
      { signal: this.unsubAbortController.signal }
    );

    flameGraphState.subscribe(
      selectors.selectedSpan,
      () => {
        this.updateContent();
      },
      { signal: this.unsubAbortController.signal }
    );
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>`;
    this.updateContent();
  }

  private updateContent() {
    const span = selectors.selectedSpan(flameGraphState.getState());
    const timeRange = selectors.timeRange(flameGraphState.getState());
    if (!span) return;
    const isPending = span.endTime === undefined || span.duration === undefined;
    const relativeStart =
      span.startTime !== undefined ? span.startTime - timeRange.minTime : 0;
    const relativeEnd = isPending
      ? null
      : (span.endTime as number) - timeRange.minTime;

    const statusText = isPending ? "In Progress" : span.status ?? "unknown";
    const statusClass = isPending
      ? ""
      : span.status === "error"
      ? "error"
      : "success";

    const payloadStr =
      span.payload && Object.keys(span.payload).length > 0
        ? JSON.stringify(span.payload, null, 2)
        : null;

    const position = selectors.detailsPosition(flameGraphState.getState());
    const handlePosition = selectors.getHandlePosition(position);

    // TODO: use patching instead of innerHTML
    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <flame-graph-resize-handle
        position="${handlePosition}"
      ></flame-graph-resize-handle>
      <div class="header">
        <div class="title">${escapeHtml(span.name ?? "Unknown")}</div>
        <button class="icon-only close-btn" part="close">✕</button>
      </div>
      <div class="content">
        <div class="grid">
          <div class="item">
            <span class="label">Duration</span>
            <span class="value duration"
              >${isPending ? "–" : formatTime(span.duration as number)}</span
            >
          </div>
          <div class="item">
            <span class="label">Start</span>
            <span class="value">+${formatTime(relativeStart)}</span>
          </div>
          <div class="item">
            <span class="label">End</span>
            <span class="value"
              >${relativeEnd === null
                ? "–"
                : `+${formatTime(relativeEnd)}`}</span
            >
          </div>
          <div class="item">
            <span class="label">Status</span>
            <span class="value ${statusClass}">${statusText}</span>
          </div>
        </div>
        ${payloadStr
          ? `
          <div class="payload">
            <div class="payload-title">Payload</div>
            <div class="payload-content">${escapeHtml(payloadStr)}</div>
          </div>
        `
          : ""}
      </div>
    `;

    this.resizeHandle = getElement(
      "flame-graph-resize-handle",
      this.shadowRoot
    );
    getElement(".close-btn", this.shadowRoot).addEventListener("click", () => {
      flameGraphState.setDetailsVisible(false);
    });

    this.resizeHandle.addEventListener("resize", (e) => {
      const detail = e.detail as unknown as ResizeEventDetail;
      const layout = selectors.detailsLayout(flameGraphState.getState());
      const position = selectors.detailsPosition(flameGraphState.getState());

      // Delta sign depends on handle position:
      // - details bottom (handle top): drag up = -deltaY = bigger height
      // - details left (handle right): drag right = +deltaX = bigger width
      // - details right (handle left): drag left = -deltaX = bigger width
      const widthDelta = position === "left" ? detail.deltaX : -detail.deltaX;
      const heightDelta = -detail.deltaY;

      flameGraphState.resizeDetails(
        layout.width + widthDelta,
        layout.height + heightDelta
      );
    });
  }
}

customElements.define("flame-graph-details", FlameGraphDetails);
