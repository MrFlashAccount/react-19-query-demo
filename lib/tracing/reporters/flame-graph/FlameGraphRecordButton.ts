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

export class FlameGraphRecordButton extends HTMLElement {
  private btn!: HTMLButtonElement;
  private unsubs: Array<() => void> = [];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.subscribeToState();
  }

  disconnectedCallback() {
    this.unsubs.forEach((u) => u());
  }

  private getLabel(isRecording: boolean): string {
    return isRecording ? "🛑 Stop" : "🎥 Record";
  }

  private getClassName(isRecording: boolean): string {
    return isRecording ? "stop" : "record";
  }

  private render() {
    if (!this.shadowRoot) return;

    const isRecording = flameGraphState.store.getKey("isRecording");

    this.shadowRoot.innerHTML = html`
      <style>
        ${STYLES}
      </style>
      <button class="${this.getClassName(isRecording)}">
        ${this.getLabel(isRecording)}
      </button>
    `;

    this.btn = this.shadowRoot.querySelector("button")!;
    this.btn.addEventListener("click", this.handleClick);
  }

  private subscribeToState() {
    this.unsubs.push(
      flameGraphState.subscribe<boolean>("isRecording", (isRecording) => {
        if (!this.btn) return;
        this.btn.className = this.getClassName(isRecording);
        this.btn.textContent = this.getLabel(isRecording);
      })
    );
  }

  private handleClick = () => {
    flameGraphState.toggleRecording();
  };
}

customElements.define("flame-graph-record-button", FlameGraphRecordButton);
