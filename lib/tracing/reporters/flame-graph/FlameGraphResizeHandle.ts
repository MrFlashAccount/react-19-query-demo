import { CSS_VARS, ui } from "./styles";
import { css, html } from "./utilities";

const STYLES = css`
  ${CSS_VARS}

  :host {
    display: block;
    position: absolute;
    left: 0;
    right: 0;
    height: 8px;
    cursor: ns-resize;
    background: transparent;
    z-index: 10;
    touch-action: none;
  }

  :host([position="top"]) {
    top: 0;
  }

  :host([position="bottom"]) {
    bottom: 0;
  }

  .handle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 4px;
    background: ${ui.handleDefault};
    border-radius: 2px;
    transition: background 0.15s;
  }

  :host(:hover) .handle,
  :host([active]) .handle {
    background: ${ui.handleHover};
  }
`;

export interface ResizeEventDetail {
  deltaY: number;
  clientY: number;
}

export class FlameGraphResizeHandle extends HTMLElement {
  private isDragging = false;
  private lastY = 0;
  private rafId = -1;
  private pendingDelta = 0;
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
    this.cancelAnimationFrame();
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
    this.lastY = e.clientY;
    this.pendingDelta = 0;
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

    const deltaY = e.clientY - this.lastY;
    this.pendingDelta += deltaY;
    this.lastY = e.clientY;

    if (this.pendingDelta !== 0) {
      this.dispatchEvent(
        new CustomEvent<ResizeEventDetail>("resize", {
          bubbles: true,
          detail: {
            deltaY: this.pendingDelta,
            clientY: this.lastY,
          },
        })
      );
      this.pendingDelta = 0;
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

    // Cancel any pending animation frame
    this.cancelAnimationFrame();

    if (this.pendingDelta !== 0) {
      this.dispatchEvent(
        new CustomEvent<ResizeEventDetail>("resize", {
          bubbles: true,
          detail: { deltaY: this.pendingDelta, clientY: this.lastY },
        })
      );
      this.pendingDelta = 0;
    }

    this.dispatchEvent(new CustomEvent("resizeend", { bubbles: true }));
  };

  private cancelAnimationFrame() {
    if (this.rafId !== -1) {
      cancelAnimationFrame(this.rafId);
      this.rafId = -1;
    }
  }
}

customElements.define("flame-graph-resize-handle", FlameGraphResizeHandle);
