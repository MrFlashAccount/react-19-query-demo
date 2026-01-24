import { HOST_STYLES, theme } from "./styles";
import { css, html } from "./utilities";

const STYLES = css`
  ${HOST_STYLES()}

  :host {
    display: block;
    position: absolute;
    background: transparent;
    z-index: 10;
    touch-action: none;
  }

  /* Vertical resize (top/bottom) */
  :host([position="top"]),
  :host([position="bottom"]) {
    left: 0;
    right: 0;
    height: 8px;
    cursor: ns-resize;
  }

  :host([position="top"]) {
    top: 0;
  }

  :host([position="bottom"]) {
    bottom: 0;
  }

  /* Horizontal resize (left/right) */
  :host([position="left"]),
  :host([position="right"]) {
    top: 0;
    bottom: 0;
    width: 8px;
    cursor: ew-resize;
  }

  :host([position="left"]) {
    left: 0;
  }

  :host([position="right"]) {
    right: 0;
  }

  .handle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: ${theme.ui.handleDefault};
    border-radius: 2px;
    transition: background 0.15s;
  }

  /* Horizontal handle (for vertical resize) */
  :host([position="top"]) .handle,
  :host([position="bottom"]) .handle {
    width: 40px;
    height: 4px;
  }

  /* Vertical handle (for horizontal resize) */
  :host([position="left"]) .handle,
  :host([position="right"]) .handle {
    width: 4px;
    height: 40px;
  }

  :host(:hover) .handle,
  :host([active]) .handle {
    background: ${theme.ui.handleHover};
  }
`;

export interface ResizeEventDetail {
  deltaX: number;
  deltaY: number;
  clientX: number;
  clientY: number;
}

export class FlameGraphResizeHandle extends HTMLElement {
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private pendingDeltaX = 0;
  private pendingDeltaY = 0;
  private unmountAbortController = new AbortController();

  static get observedAttributes() {
    return ["position"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.addEventListener("pointerdown", this.handlePointerDown, {
      passive: true,
      signal: this.unmountAbortController.signal,
    });
    this.render();
  }

  disconnectedCallback() {
    this.unmountAbortController.abort();
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <div class="handle"></div>
    `;
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;

    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.pendingDeltaX = 0;
    this.pendingDeltaY = 0;
    this.setAttribute("active", "");
    this.setPointerCapture(e.pointerId);

    document.addEventListener("pointermove", this.handlePointerMove, {
      passive: true,
      signal: this.unmountAbortController.signal,
    });
    document.addEventListener("pointerup", this.handlePointerUp, {
      passive: true,
      signal: this.unmountAbortController.signal,
    });
    document.addEventListener("pointercancel", this.handlePointerUp, {
      passive: true,
      signal: this.unmountAbortController.signal,
    });

    this.dispatchEvent(new CustomEvent("resizestart", { bubbles: true }));
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.lastX;
    const deltaY = e.clientY - this.lastY;
    this.pendingDeltaX += deltaX;
    this.pendingDeltaY += deltaY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    if (this.pendingDeltaX !== 0 || this.pendingDeltaY !== 0) {
      this.dispatchEvent(
        new CustomEvent<ResizeEventDetail>("resize", {
          detail: {
            deltaX: this.pendingDeltaX,
            deltaY: this.pendingDeltaY,
            clientX: this.lastX,
            clientY: this.lastY,
          },
        }),
      );
      this.pendingDeltaX = 0;
      this.pendingDeltaY = 0;
    }
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.removeAttribute("active");
    this.releasePointerCapture(e.pointerId);

    document.removeEventListener("pointermove", this.handlePointerMove);
    document.removeEventListener("pointerup", this.handlePointerUp);
    document.removeEventListener("pointercancel", this.handlePointerUp);

    if (this.pendingDeltaX !== 0 || this.pendingDeltaY !== 0) {
      this.dispatchEvent(
        new CustomEvent<ResizeEventDetail>("resize", {
          bubbles: true,
          detail: {
            deltaX: this.pendingDeltaX,
            deltaY: this.pendingDeltaY,
            clientX: this.lastX,
            clientY: this.lastY,
          },
        }),
      );
      this.pendingDeltaX = 0;
      this.pendingDeltaY = 0;
    }

    this.dispatchEvent(new CustomEvent("resizeend", { bubbles: true }));
  };
}

customElements.define("flame-graph-resize-handle", FlameGraphResizeHandle);
