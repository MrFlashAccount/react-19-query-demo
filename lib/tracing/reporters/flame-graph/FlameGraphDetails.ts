import {
  CSS_VARS,
  BUTTON_STYLES,
  formatTime,
  escapeHtml,
  details,
} from "./styles";
import type { FlameGraphSpan, TimeRange } from "./types";
import type { ResizeEventDetail } from "./FlameGraphResizeHandle";
import "./FlameGraphResizeHandle";
import { css, html } from "./utilities";
import { drawScheduler } from "./DrawScheduler";

const STYLES = css`
  ${CSS_VARS}
  ${BUTTON_STYLES}
  
  :host {
    display: none;
    flex-direction: column;
    flex-shrink: 0;
    background: var(--fg-bg-overlay);
    border-top: 1px solid var(--fg-border);
    font-size: 12px;
    color: var(--fg-text);
    height: 160px;
    min-height: 80px;
    max-height: 50vh;
    position: relative;
    font-family: var(--fg-font);
  }

  :host([visible]) {
    display: flex;
  }

  flame-graph-resize-handle {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
  }

  flame-graph-resize-handle .handle {
    width: 32px;
    height: 3px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 10px 16px 8px;
    background: ${details.headerBg};
    border-bottom: 1px solid var(--fg-border-subtle);
    flex-shrink: 0;
  }

  .title {
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
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
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
  private _span: Partial<FlameGraphSpan> | null = null;
  private _timeRange: TimeRange = { minTime: 0, maxTime: 0 };
  private currentHeight = 160;

  static get observedAttributes() {
    return ["visible"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  disconnectedCallback() {
    // Cleanup handled by resize handle component
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>`;
    this.updateContent();
  }

  private setupEventListeners() {
    // Resize events handled in updateContent after element is created
  }

  private updateContent() {
    if (!this.shadowRoot || !this._span) return;

    const span = this._span;
    const isPending = span.endTime === undefined || span.duration === undefined;
    const relativeStart =
      span.startTime !== undefined
        ? span.startTime - this._timeRange.minTime
        : 0;
    const relativeEnd = isPending
      ? null
      : (span.endTime as number) - this._timeRange.minTime;

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

    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <flame-graph-resize-handle position="top"></flame-graph-resize-handle>
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

    // Bind events
    this.shadowRoot
      .querySelector(".close-btn")
      ?.addEventListener("click", () => this.hide());

    this.shadowRoot
      .querySelector("flame-graph-resize-handle")
      ?.addEventListener("resize", ((e: CustomEvent<ResizeEventDetail>) => {
        const newHeight = Math.max(
          80,
          Math.min(
            window.innerHeight * 0.5,
            this.currentHeight - e.detail.deltaY
          )
        );
        this.currentHeight = newHeight;
        drawScheduler.schedule(() => {
          this.style.height = `${newHeight}px`;
        });
      }) as EventListener);
  }

  // Public API
  show(span: Partial<FlameGraphSpan>) {
    this._span = span;
    this.setAttribute("visible", "");
    this.updateContent();
  }

  hide() {
    this.removeAttribute("visible");
    this._span = null;
    this.dispatchEvent(new CustomEvent("close", { bubbles: true }));
  }

  set timeRange(value: TimeRange) {
    this._timeRange = value;
    if (this._span) this.updateContent();
  }

  get span(): Partial<FlameGraphSpan> | null {
    return this._span;
  }
}

customElements.define("flame-graph-details", FlameGraphDetails);
