import { CSS_VARS, BUTTON_STYLES, ui } from "./styles";
import type { ResizeEventDetail } from "./FlameGraphResizeHandle";
import type { FlameGraphDialogContent } from "./FlameGraphDialogContent";

// Import components to ensure they're registered
import "./FlameGraphDialogContent";
import "./FlameGraphResizeHandle";
import "./FlameGraphRecordButton";
import "./FlameGraphClearButton";
import { css, getElement, html } from "./utilities";
import { drawScheduler } from "./DrawScheduler";
import { flameGraphState } from "./state";

// TypeScript types for Document Picture-in-Picture API
interface DocumentPictureInPictureOptions {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
}

interface DocumentPictureInPicture {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

const STYLES = css`
  ${CSS_VARS}
  ${BUTTON_STYLES}

  flame-graph-resize-handle {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
  }

  .layout-isolated {
    pointer-events: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: 0;
    overflow: visible;
    overflow-clip-margin: unset;
    contain: content;
  }

  .layout-isolated-content {
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  .panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 350px;
    min-height: 300px;
    max-height: 80vh;
    margin: 0;
    padding: 0;
    border: none;
    background: linear-gradient(
      180deg,
      var(--fg-bg-primary) 0%,
      var(--fg-bg-secondary) 100%
    );
    border-radius: var(--fg-radius-xl) var(--fg-radius-xl) 0 0;
    flex-direction: column;
    overflow: clip;
    font-family: var(--fg-font);
    overscroll-behavior: contain;
    display: none;
    contain: content;
    pointer-events: auto;
  }

  .panel.resizing {
    will-change: height;
  }

  .panel.open {
    display: flex;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: ${ui.surfaceActive};
    border-bottom: 1px solid var(--fg-border);
    flex-shrink: 0;
  }

  .title {
    font-size: 14px;
    font-weight: 600;
    color: var(--fg-text);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .pip-btn {
    display: none;
  }

  .pip-supported .pip-btn {
    display: inline-flex;
  }

  flame-graph-dialog-content {
    flex: 1;
    min-height: 0;
  }
`;

export class FlameGraphDialog extends HTMLElement {
  private panel!: HTMLDivElement;
  private content!: FlameGraphDialogContent;
  private pipSupported = false;
  private unsubs: Array<() => void> = [];

  static get observedAttributes() {
    return ["popover"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.popover = this.getAttribute("popover") ?? "manual";
    this.render();
    this.setupEventListeners();
    this.subscribeToState();
    this.style.all = "unset";
    this.style.colorScheme = "dark";
    this.pipSupported = "documentPictureInPicture" in window;
  }

  disconnectedCallback() {
    this.unsubs.forEach((u) => u());
  }

  private subscribeToState() {
    // Subscribe to isOpen
    this.unsubs.push(
      flameGraphState.subscribe<boolean>("isOpen", (isOpen) => {
        if (isOpen) {
          this.panel.classList.add("open");
          this.showPopover();
        } else {
          this.panel.classList.remove("open");
          this.hidePopover();
        }
      })
    );

    // Subscribe to height changes
    this.unsubs.push(
      flameGraphState.subscribe<number>("height", (height) => {
        drawScheduler.schedule(() => {
          this.panel.style.height = `${height}px`;
        });
      })
    );
  }

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <svg class="layout-isolated" width="100%" height="100%">
        <foreignObject
          class="layout-isolated-content"
          width="100%"
          height="100%"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="flame-graph-dialog-title"
            class="panel ${this.pipSupported ? "pip-supported" : ""}"
            style="width: 100%; height: ${flameGraphState.store.getKey(
              "height"
            )}px;"
          >
            <flame-graph-resize-handle
              position="top"
            ></flame-graph-resize-handle>
            <div class="header">
              <div class="title" id="flame-graph-dialog-title">
                🔥 Flame Graph
              </div>
              <div class="controls">
                <flame-graph-record-button></flame-graph-record-button>
                <flame-graph-clear-button></flame-graph-clear-button>
                <button
                  class="pip-btn icon-only"
                  data-action="pip"
                  aria-label="Picture in Picture"
                >
                  📌
                </button>
                <button
                  class="icon-only"
                  data-action="close"
                  aria-label="minimize"
                >
                  ✕
                </button>
              </div>
            </div>
            <flame-graph-dialog-content></flame-graph-dialog-content>
          </div>
        </foreignObject>
      </svg>
    `;

    this.panel = getElement(".panel", this.shadowRoot);
    this.content = getElement(
      "flame-graph-dialog-content",
      this.shadowRoot
    ) as FlameGraphDialogContent;
  }

  private handleClick = (e: Event) => {
    const target = e.target as HTMLElement;
    const btn = target.closest("[data-action]") as HTMLElement;
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === "close") this.close();
  };

  private setupEventListeners() {
    // Button controls
    this.shadowRoot?.addEventListener("click", this.handleClick);

    // Resize handle
    this.shadowRoot
      ?.querySelector("flame-graph-resize-handle")
      ?.addEventListener("resize", ((e: CustomEvent<ResizeEventDetail>) => {
        const currentHeight = flameGraphState.store.getKey("height");
        const newHeight = Math.max(300, currentHeight - e.detail.deltaY);
        flameGraphState.setHeight(newHeight);
      }) as EventListener);

    // Content events bubble up
    this.content?.addEventListener("spanselect", ((e: CustomEvent) => {
      this.dispatchEvent(
        new CustomEvent("spanselect", { detail: e.detail, bubbles: true })
      );
    }) as EventListener);
  }

  // Public API
  show() {
    flameGraphState.open();
  }

  close() {
    flameGraphState.close();
    this.dispatchEvent(new CustomEvent("close", { bubbles: true }));
  }

  get open(): boolean {
    return flameGraphState.store.getKey("isOpen");
  }

  get isPipMode(): boolean {
    return flameGraphState.store.getKey("isPipMode");
  }

  set recording(value: boolean) {
    if (value) {
      flameGraphState.startRecording();
    } else {
      flameGraphState.stopRecording();
    }
  }

  get recording(): boolean {
    return flameGraphState.store.getKey("isRecording");
  }

  get popover() {
    return this.getAttribute("popover") ?? "manual";
  }

  set popover(val: string) {
    if (val) {
      this.setAttribute("popover", val);
    } else {
      this.removeAttribute("popover");
    }
  }
}

customElements.define("flame-graph-dialog", FlameGraphDialog);
