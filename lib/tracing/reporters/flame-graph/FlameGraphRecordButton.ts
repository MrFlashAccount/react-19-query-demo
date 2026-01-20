import { BUTTON_STYLES, HOST_STYLES, theme } from "./styles";
import { css, html } from "./utilities";
import { flameGraphState, selectors } from "./state";

/** Button state colors */
export const button = {
  record: {
    bg: "oklch(0.63 0.24 27 / 0.15)",
    bgHover: "oklch(0.63 0.24 27 / 0.25)",
    border: "oklch(0.63 0.24 27 / 0.3)",
    text: theme.accent.errorLight,
  },
  stop: {
    bg: "oklch(0.72 0.19 145 / 0.15)",
    bgHover: "oklch(0.72 0.19 145 / 0.25)",
    border: "oklch(0.72 0.19 145 / 0.3)",
    text: theme.accent.success,
  },
} as const;

const STYLES = css`
  ${BUTTON_STYLES}
  ${HOST_STYLES}

  :host {
    display: contents;
  }

  button.record {
    background: ${button.record.bg};
    border-color: ${button.record.border};
    color: ${button.record.text};
  }
  button.record:hover {
    background: ${button.record.bgHover};
  }
  button.stop {
    background: ${button.stop.bg};
    border-color: ${button.stop.border};
    color: ${button.stop.text};
  }
  button.stop:hover {
    background: ${button.stop.bgHover};
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

    const isRecording = selectors.isRecording(flameGraphState.getState());

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
      flameGraphState.subscribe(selectors.isRecording, (isRecording) => {
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
