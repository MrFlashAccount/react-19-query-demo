import { html, render } from "lit-html";
import { ref, createRef, type Ref } from "lit-html/directives/ref.js";
import type { OverlayLevel } from "./PerformanceObserver";
import { css } from "./utils";

export interface PerformanceSettingsState {
  level: OverlayLevel;
  position: "top" | "bottom";
  sampleInterval: number;
}

export interface PerformanceSettingsChangeEvent extends CustomEvent {
  detail: Partial<PerformanceSettingsState>;
}

const styles = css`
  :host {
    display: block;
    font-family:
      "JetBrains Mono", "SF Mono", "Fira Code", "Cascadia Code", Menlo, Consolas, "DejaVu Sans Mono",
      monospace;
    font-size: 12px;
  }
  
  .settings-wrapper {
    position: relative;
    pointer-events: auto;
    display: flex;
    align-items: center;
    height: 100%;
  }
  
  .settings-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    color: #666;
    transition:
      color 0.15s,
      background 0.15s;
  }
  
  .settings-btn:hover {
    color: #999;
    background: rgba(255, 255, 255, 0.05);
  }
  
  .settings-btn.active {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
  }
  
  .settings-btn svg {
    width: 14px;
    height: 14px;
  }
  
  .settings-popover {
    /* Reset popover defaults */
    border: none;
    padding: 0;
    background: transparent;
    overflow: visible;
  
    /* Anchor positioning with viewport-aware fallbacks */
    margin: unset;
    position-area: block-end span-inline-start;
    margin-block-start: 4px;
  
    /* Flip vertically/horizontally if would overflow viewport */
    position-try-fallbacks:
      flip-block,
      flip-inline,
      flip-block flip-inline;
    position-try-order: most-height;
  
    /* Content styling */
    min-width: 200px;
  
    /* Animation */
    transition:
      opacity 0.15s ease-out,
      transform 0.15s ease-out,
      overlay 0.15s ease-out allow-discrete,
      display 0.15s ease-out allow-discrete;
  }
  
  /* When overlay is at bottom, prefer opening upward */
  :host([dropdown-position="top"]) .settings-popover {
    position-area: block-start span-inline-start;
    margin-block-start: 0;
    margin-block-end: 4px;
    position-try-fallbacks:
      flip-block,
      flip-inline,
      flip-block flip-inline;
  }
  
  .settings-popover:popover-open {
    opacity: 1;
    transform: translateY(0);
  }
  
  @starting-style {
    .settings-popover:popover-open {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  
  .settings-content {
    background: rgba(15, 15, 20, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    corner-shape: superellipse(1.33);
    padding: 8px 0;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
  }
  
  .settings-group {
    padding: 8px 12px;
  }
  
  .settings-group + .settings-group {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  
  .settings-label {
    color: #888;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }
  
  .level-selector {
    display: flex;
    gap: 4px;
  }
  
  .level-btn {
    all: unset;
    cursor: pointer;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    color: #666;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid transparent;
    transition: all 0.15s;
  }
  
  .level-btn:hover {
    color: #999;
    background: rgba(255, 255, 255, 0.06);
  }
  
  .level-btn.selected {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }
  
  .position-toggle {
    display: flex;
    gap: 4px;
  }
  
  .position-btn {
    all: unset;
    cursor: pointer;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
    color: #666;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid transparent;
    transition: all 0.15s;
  }
  
  .position-btn:hover {
    color: #999;
    background: rgba(255, 255, 255, 0.06);
  }
  
  .position-btn.selected {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
  }
  
  .position-btn svg {
    width: 12px;
    height: 12px;
  }
  
  .interval-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .interval-input {
    all: unset;
    flex: 1;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
    color: #e4e4e7;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    text-align: right;
    min-width: 0;
  }
  
  .interval-input:focus {
    border-color: rgba(59, 130, 246, 0.5);
    background: rgba(59, 130, 246, 0.05);
  }
  
  .interval-unit {
    color: #666;
    font-size: 10px;
    font-weight: 500;
    min-width: 20px;
  }
  
  .level-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 8px;
  }
  
  .level-indicator.off {
    background: #444;
  }
  .level-indicator.basic {
    background: #3b82f6;
  }
  .level-indicator.detailed {
    background: #22c55e;
  }
`;

const gearIcon = html`
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="3"></circle>
    <path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
    ></path>
  </svg>
`;

const topIcon = html`
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="3" y1="9" x2="21" y2="9"></line>
  </svg>
`;

const bottomIcon = html`
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="3" y1="15" x2="21" y2="15"></line>
  </svg>
`;

export class PerformanceSettings extends HTMLElement {
  readonly shadowRoot: ShadowRoot;
  private _level: OverlayLevel = 1;
  private _position: "top" | "bottom" = "top";
  private _sampleInterval: number = 500;
  private _open = false;
  private popoverRef: Ref<HTMLDivElement> = createRef();
  private buttonRef: Ref<HTMLButtonElement> = createRef();

  static get observedAttributes(): string[] {
    return ["level", "position", "sample-interval", "dropdown-position"];
  }

  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this._level = (parseInt(this.getAttribute("level") || "1", 10) as OverlayLevel) || 1;
    this._position = (this.getAttribute("position") as "top" | "bottom") || "top";
    this._sampleInterval = parseInt(this.getAttribute("sample-interval") || "500", 10) || 500;
    this.render();
  }

  disconnectedCallback(): void {
    // Popover API handles cleanup automatically
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
    if (oldValue === newValue) return;

    if (name === "level") {
      this._level = parseInt(newValue, 10) as OverlayLevel;
    } else if (name === "position") {
      this._position = newValue as "top" | "bottom";
    } else if (name === "sample-interval") {
      this._sampleInterval = parseInt(newValue, 10) || 500;
    }

    if (this.isConnected) {
      this.render();
    }
  }

  get level(): OverlayLevel {
    return this._level;
  }

  set level(val: OverlayLevel) {
    this._level = val;
    this.setAttribute("level", String(val));
  }

  get position(): "top" | "bottom" {
    return this._position;
  }

  set position(val: "top" | "bottom") {
    this._position = val;
    this.setAttribute("position", val);
  }

  get sampleInterval(): number {
    return this._sampleInterval;
  }

  set sampleInterval(val: number) {
    this._sampleInterval = val;
    this.setAttribute("sample-interval", String(val));
  }

  get open(): boolean {
    return this._open;
  }

  set open(val: boolean) {
    this._open = val;
    const popover = this.popoverRef.value;
    if (popover) {
      if (val) {
        popover.showPopover();
      } else {
        popover.hidePopover();
      }
    }
  }

  private handleToggle = (e: ToggleEvent): void => {
    this._open = e.newState === "open";
    // Update button active state
    const btn = this.buttonRef.value;
    if (btn) {
      btn.classList.toggle("active", this._open);
    }
  };

  private emitChange(detail: Partial<PerformanceSettingsState>): void {
    this.dispatchEvent(
      new CustomEvent("settings-change", { detail, bubbles: true, composed: true }),
    );
  }

  private handleLevelChange = (newLevel: OverlayLevel) => (): void => {
    this._level = newLevel;
    this.emitChange({ level: newLevel });
    this.render();
  };

  private handlePositionChange = (newPosition: "top" | "bottom") => (): void => {
    this._position = newPosition;
    this.emitChange({ position: newPosition });
    this.render();
  };

  private handleIntervalChange = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value >= 50 && value <= 5000) {
      this._sampleInterval = value;
      this.emitChange({ sampleInterval: value });
    }
  };

  private render(): void {
    const template = html`
      <style>${styles}</style>
      <div class="settings-wrapper">
        <button 
          ${ref(this.buttonRef)}
          class="settings-btn ${this._open ? "active" : ""}" 
          title="Performance Settings"
          popovertarget="performance-settings-popover"
          popovertargetaction="toggle"
        >${gearIcon}</button>
        <div 
          ${ref(this.popoverRef)}
          id="performance-settings-popover"
          class="settings-popover"
          popover="auto"
          @toggle=${this.handleToggle}
        >
          <div class="settings-content">
            <div class="settings-group">
              <div class="settings-label">Level</div>
              <div class="level-selector">
                <button 
                  class="level-btn ${this._level === 0 ? "selected" : ""}" 
                  @click=${this.handleLevelChange(0)}
                >Off</button>
                <button 
                  class="level-btn ${this._level === 1 ? "selected" : ""}" 
                  @click=${this.handleLevelChange(1)}
                >Basic</button>
                <button 
                  class="level-btn ${this._level === 2 ? "selected" : ""}" 
                  @click=${this.handleLevelChange(2)}
                >Detailed</button>
              </div>
            </div>
            
            <div class="settings-group">
              <div class="settings-label">Position</div>
              <div class="position-toggle">
                <button 
                  class="position-btn ${this._position === "top" ? "selected" : ""}" 
                  @click=${this.handlePositionChange("top")}
                >${topIcon} Top</button>
                <button 
                  class="position-btn ${this._position === "bottom" ? "selected" : ""}" 
                  @click=${this.handlePositionChange("bottom")}
                >${bottomIcon} Bottom</button>
              </div>
            </div>
            
            <div class="settings-group">
              <div class="settings-label">Update Interval</div>
              <div class="interval-row">
                <input 
                  type="number" 
                  class="interval-input" 
                  .value=${String(this._sampleInterval)}
                  min="50"
                  max="5000"
                  step="50"
                  @change=${this.handleIntervalChange}
                />
                <span class="interval-unit">ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    render(template, this.shadowRoot);
  }
}

customElements.define("performance-settings", PerformanceSettings);
