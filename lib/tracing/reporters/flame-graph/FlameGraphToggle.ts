import { flameGraphState } from "./state";
import { CSS_VARS, toggle, shadow } from "./styles";
import { css, html } from "./utilities";

const STYLES = css`
  ${CSS_VARS}

  :host {
    all: unset;
    display: block;
    position: fixed;
  }

  button {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: ${toggle.bgGradient};
    color: white;
    font-size: 24px;
    cursor: pointer;
    box-shadow: 0 4px 20px ${shadow.toggleGlow};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  @media (hover: hover) and (pointer: fine) {
    button:hover {
      transform: scale(1.08);
    }
  }

  :host([recording]) button {
    background: ${toggle.bgGradientRecord};
  }
`;

export class FlameGraphToggle extends HTMLElement {
  private button: HTMLButtonElement | null = null;

  static get observedAttributes() {
    return ["recording", "position"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.updatePosition();
  }

  attributeChangedCallback(name: string) {
    if (name === "position") {
      this.updatePosition();
    }
  }

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <button title="Toggle Flame Graph">🔥</button>
    `;

    this.button = this.shadowRoot.querySelector("button");
    this.button?.addEventListener("click", () => {
      flameGraphState.open();
    });
  }

  private updatePosition() {
    const pos = this.getAttribute("position") || "bottom-right";
    const offset = "20px";

    this.style.top = pos.includes("top") ? offset : "auto";
    this.style.bottom = pos.includes("bottom") ? offset : "auto";
    this.style.left = pos.includes("left") ? offset : "auto";
    this.style.right = pos.includes("right") ? offset : "auto";
  }

  set recording(value: boolean) {
    if (value) {
      this.setAttribute("recording", "");
    } else {
      this.removeAttribute("recording");
    }
  }

  get recording(): boolean {
    return this.hasAttribute("recording");
  }
}

customElements.define("flame-graph-toggle", FlameGraphToggle);
