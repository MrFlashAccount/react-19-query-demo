import { BUTTON_STYLES, RESET_CASCADE, HOST_STYLES } from "./styles";
import { css, getElement, html } from "./utilities";
import { flameGraphState, selectors, type FlameGraphState } from "./state";

const STYLES = css`
  ${HOST_STYLES}
  ${BUTTON_STYLES}

  :host {
    ${RESET_CASCADE}
    display: contents;
  }

  button.hidden {
    display: none;
  }
`;

export class FlameGraphClearButton extends HTMLElement {
  shadowRoot!: ShadowRoot;
  btn!: HTMLButtonElement;

  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    flameGraphState.subscribe(this.selectState, ({ isRecording, hasSpans }) => {
      this.btn.className = this.getClassName(isRecording, hasSpans);
    });
  }

  private render() {
    const { isRecording, hasSpans } = this.selectState(
      flameGraphState.getState()
    );
    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <button class="${this.getClassName(isRecording, hasSpans)}">
        🧹 Clear
      </button>
    `;

    this.btn = getElement("button", this.shadowRoot);
    this.btn.addEventListener("click", this.handleClick);
  }

  private getClassName(isRecording: boolean, hasSpans: boolean): string {
    return `${isRecording || !hasSpans ? "hidden" : ""}`;
  }

  private handleClick = () => {
    flameGraphState.clearRecording();
  };

  private selectState = (state: FlameGraphState) => {
    const isRecording = selectors.isRecording(state);
    const hasSpans = selectors.hasSpans(state);

    return { isRecording, hasSpans };
  };
}

customElements.define("flame-graph-clear-button", FlameGraphClearButton);
