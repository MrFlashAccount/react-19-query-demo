import { HOST_STYLES, theme } from "./styles";
import type { ResizeEventDetail } from "./FlameGraphResizeHandle";
import type { FlameGraphDialogContent } from "./FlameGraphDialogContent";
import type { Position } from "./types";
import { addEventListener } from "./utilities";

// Import components to ensure they're registered
import "./FlameGraphDialogContent";
import "./FlameGraphResizeHandle";
import { css, getElement, html } from "./utilities";
import { drawScheduler } from "./DrawScheduler";
import { flameGraphState, selectors } from "./state";

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
  ${HOST_STYLES({ contain: false })}
  :host {
    color-scheme: dark;
  }

  flame-graph-resize-handle {
    position: absolute;
  }

  flame-graph-resize-handle[position="top"] {
    top: 0;
    left: 0;
    right: 0;
  }

  flame-graph-resize-handle[position="left"] {
    top: 0;
    left: 0;
    bottom: 0;
  }

  flame-graph-resize-handle[position="right"] {
    top: 0;
    right: 0;
    bottom: 0;
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
    margin: 0;
    padding: 0;
    border: none;
    background: linear-gradient(
      180deg,
      ${theme.ui.bgPrimary} 0%,
      ${theme.ui.bgSecondary} 100%
    );
    flex-direction: column;
    overflow: clip;
    font-family: ${theme.family.default};
    overscroll-behavior: contain;
    display: none;
    contain: content;
    pointer-events: auto;
  }

  /* Position: bottom */
  .panel.position-bottom {
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    border-radius: ${theme.radius.xl}px ${theme.radius.xl}px 0 0;
  }

  /* Position: left */
  .panel.position-left {
    top: 0;
    left: 0;
    bottom: 0;
    border-radius: 0 ${theme.radius.xl}px ${theme.radius.xl}px 0;
  }

  /* Position: right */
  .panel.position-right {
    top: 0;
    right: 0;
    bottom: 0;
    border-radius: ${theme.radius.xl}px 0 0 ${theme.radius.xl}px;
  }

  .panel.resizing {
    will-change: height, width;
  }

  .panel.open {
    display: flex;
  }

  flame-graph-dialog-content {
    flex: 1;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }
`;

export class FlameGraphDialog extends HTMLElement {
  shadowRoot!: ShadowRoot;
  private panel!: HTMLDivElement;
  private content!: FlameGraphDialogContent;
  private resizeHandle!: HTMLElement;
  private unsubs: Array<() => void> = [];
  private resizeObserver: ResizeObserver | null = null;

  static get observedAttributes() {
    return ["popover"];
  }

  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.popover = this.getAttribute("popover") ?? "manual";
    this.render();
    this.setupEventListeners();
    this.subscribeToState();
  }

  disconnectedCallback() {
    this.unsubs.forEach((u) => u());
    this.resizeObserver?.disconnect();
  }

  /**
   * Apply calculated layout to the dialog panel.
   * All sizing/positioning comes from the layout state.
   */
  private applyLayoutToPanel(
    layout: ReturnType<typeof selectors.dialogLayout>
  ) {
    this.panel.style.width = `${layout.width}px`;
    this.panel.style.height = `${layout.height}px`;
    this.panel.style.top = layout.position.top;
    this.panel.style.left = layout.position.left;
    this.panel.style.right = layout.position.right;
    this.panel.style.bottom = layout.position.bottom;
  }

  private updatePanelPosition(position: Position) {
    if (!this.panel || !this.resizeHandle) return;

    // Remove old position classes
    this.panel.classList.remove(
      "position-bottom",
      "position-left",
      "position-right"
    );
    // Add new position class
    this.panel.classList.add(`position-${position}`);

    // Update resize handle position
    this.resizeHandle.setAttribute(
      "position",
      selectors.getHandlePosition(position)
    );
  }

  private subscribeToState() {
    // Subscribe to isOpen
    this.unsubs.push(
      flameGraphState.subscribe(selectors.isOpen, (isOpen) => {
        if (isOpen) {
          this.panel.classList.add("open");
          this.showPopover();
        } else {
          this.panel.classList.remove("open");
          this.hidePopover();
        }
      })
    );

    // Subscribe to dialog position changes (for CSS class updates)
    this.unsubs.push(
      flameGraphState.subscribe(selectors.dialogPosition, (position) => {
        drawScheduler.schedule(() => {
          this.updatePanelPosition(position);
        });
      })
    );

    // Single subscription to calculated layout - applies all sizing
    this.unsubs.push(
      flameGraphState.subscribe(selectors.dialogLayout, (layout) => {
        drawScheduler.schedule(() => {
          this.applyLayoutToPanel(layout);
        });
      })
    );
  }

  private render() {
    const layout = selectors.dialogLayout(flameGraphState.getState());
    const orientation = selectors.dialogPosition(flameGraphState.getState());
    const resizeHandlePosition = selectors.getHandlePosition(orientation);

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
            class="panel position-${orientation}"
            style="width: ${layout.width}px; height: ${layout.height}px;"
          >
            <flame-graph-resize-handle
              position="${resizeHandlePosition}"
            ></flame-graph-resize-handle>
            <flame-graph-dialog-content></flame-graph-dialog-content>
          </div>
        </foreignObject>
      </svg>
    `;

    this.panel = getElement(".panel", this.shadowRoot);
    this.resizeHandle = getElement(
      "flame-graph-resize-handle",
      this.shadowRoot
    );
    this.content = getElement<FlameGraphDialogContent>(
      "flame-graph-dialog-content",
      this.shadowRoot
    );
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
    this.shadowRoot.addEventListener("click", this.handleClick);
    addEventListener(
      window,
      "resize",
      () => {
        flameGraphState.onResizeWindow();
      },
      { passive: true }
    );

    // Resize handle
    this.resizeHandle.addEventListener(
      "resize",
      (e) => {
        const detail = e.detail as unknown as ResizeEventDetail;
        const layout = selectors.dialogLayout(flameGraphState.getState());

        flameGraphState.resizeDialog(
          layout.width - detail.deltaX,
          layout.height - detail.deltaY
        );
      },
      { passive: true }
    );

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
