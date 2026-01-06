import { CSS_VARS, BUTTON_STYLES } from "./styles";
import { css, html } from "./utilities";
import { flameGraphState } from "./state";

const STYLES = css`
  ${CSS_VARS}
  ${BUTTON_STYLES}

  :host {
    display: contents;
  }
`;

export class FlameGraphClearButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <button>🧹 Clear</button>
    `;

    this.shadowRoot.querySelector("button")!.addEventListener("click", this.handleClick);
  }

  private handleClick = () => {
    flameGraphState.clear();
  };
}

customElements.define("flame-graph-clear-button", FlameGraphClearButton);

