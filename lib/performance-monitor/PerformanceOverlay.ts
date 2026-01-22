import { html, render, nothing } from "lit-html";

import {
  PerformanceObserver as PerfObserver,
  type OverlayLevel,
  type PerformanceMetrics,
  type PerformanceObserverOptions,
} from "./PerformanceObserver";
import { css } from "./utils";

export interface PerformanceOverlayOptions extends PerformanceObserverOptions {
  position?: "top" | "bottom";
  sampleInterval?: number; // ms, default 500
}

const styles = css`
  :host {
    all: unset;
    display: block;
    pointer-events: none;
    font-family: "JetBrains Mono", "SF Mono", "Fira Code", monospace;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    left: 0;
    right: 0;
    height: 24px;
  }
  
  :host([position="bottom"]) {
    bottom: 0;
    top: auto;
  }
  :host(:not([position="bottom"])) {
    top: 0;
  }
  :host([position="bottom"]) .overlay {
    border-bottom: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  :host([position="bottom"]) .settings-dropdown {
    bottom: 100%;
    top: auto;
    margin-bottom: 4px;
    margin-top: 0;
  }
  
  .isolate-layout {
    all: unset;
    pointer-events: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: 0;
    overflow: visible;
    overflow-clip-margin: unset;
    contain: content;
    height: 100%;
    width: 100%;
  }
  
  .overlay {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0;
    padding: 0 8px 0 12px;
    height: 100%;
    background: rgba(10, 10, 15, 0.92);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  
  .overlay.collapsed {
    background: transparent;
    border: none;
    justify-content: flex-end;
    backdrop-filter: none;
  }
  
  .overlay-content {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .section {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    height: 100%;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .section:last-child {
    border-right: none;
  }
  
  .stat {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }
  
  .label {
    color: #666;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 9px;
  }
  
  .value {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  
  /* Fixed widths for consistent layout */
  .value-fps {
    min-width: 2.5ch;
  }
  .value-3 {
    min-width: 3ch;
  }
  .value-4 {
    min-width: 4ch;
  }
  .value-5 {
    min-width: 5ch;
  }
  
  .unit {
    color: #555;
    font-size: 8px;
    font-weight: 500;
    min-width: 2.5ch;
  }
  
  /* Color coding */
  .fps-good {
    color: #22c55e;
  }
  .fps-warn {
    color: #eab308;
  }
  .fps-bad {
    color: #ef4444;
  }
  
  .cpu-low {
    color: #22c55e;
  }
  .cpu-mid {
    color: #3b82f6;
  }
  .cpu-high {
    color: #eab308;
  }
  .cpu-crit {
    color: #ef4444;
  }
  
  .ram {
    color: #a855f7;
  }
  .ft {
    color: #e4e4e7;
  }
  .hz {
    color: #3b82f6;
  }
  
  /* Frame time graph */
  .graph-canvas {
    width: var(--canvas-width);
    height: var(--canvas-height);
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.3);
  }
  
  /* Settings button */
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
  
  /* Settings dropdown */
  .settings-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    min-width: 200px;
    background: rgba(15, 15, 20, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px 0;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-4px);
    transition:
      opacity 0.15s,
      transform 0.15s,
      visibility 0.15s;
  }
  
  .settings-dropdown.open {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }
  
  .settings-group {
    padding: 8px 12px;
  }
  
  .settings-group + .settings-group {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  
  .settings-label {
    color: #888;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }
  
  /* Level selector */
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
  
  /* Position toggle */
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
  
  /* Interval input */
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
  
  /* Level indicator dot */
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

export class PerformanceOverlay extends HTMLElement {
  readonly shadowRoot: ShadowRoot;
  private observer: PerfObserver;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private level: OverlayLevel;
  private sampleInterval: number;
  private lastRenderTime = 0;
  private isInitialRender = true;
  private dpr = window.devicePixelRatio || 1;
  private canvasWidth = 200;
  private canvasHeight = 16;
  private settingsOpen = false;

  static get observedAttributes(): string[] {
    return ["level", "position", "sample-interval", "popover"];
  }

  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: "open" });
    this.level = (parseInt(this.getAttribute("level") || "1", 10) as OverlayLevel) || 1;
    this.sampleInterval = parseInt(this.getAttribute("sample-interval") || "500", 10) || 500;
    this.popover = this.getAttribute("popover") ?? "manual";
    this.observer = new PerfObserver({
      level: this.level,
      onUpdate: (metrics) => this.onMetricsUpdate(metrics),
    });
  }

  private onMetricsUpdate(metrics: PerformanceMetrics): void {
    const now = performance.now();

    // Throttle text/stats UI updates
    const shouldRender = this.isInitialRender || now - this.lastRenderTime >= this.sampleInterval;

    if (shouldRender) {
      this.lastRenderTime = now;
      this.isInitialRender = false;
      this.render();
    }

    // Always update canvas at full speed (after render ensures canvas exists)
    if (this.level === 2 && this.canvas && this.ctx) {
      this.drawGraph(metrics.targetFps);
    }
  }

  connectedCallback(): void {
    this.render();
    if (this.level > 0) {
      this.observer.start();
    }
    this.showPopover();

    // Close settings when clicking outside
    document.addEventListener("click", this.handleDocumentClick);
  }

  disconnectedCallback(): void {
    this.observer.destroy();
    document.removeEventListener("click", this.handleDocumentClick);
  }

  private handleDocumentClick = (e: MouseEvent): void => {
    if (!this.settingsOpen) return;
    const path = e.composedPath();
    const settingsWrapper = this.shadowRoot.querySelector(".settings-wrapper");
    if (settingsWrapper && !path.includes(settingsWrapper)) {
      this.settingsOpen = false;
      this.render();
    }
  };

  attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
    if (oldValue === newValue) return;

    if (name === "level") {
      this.level = parseInt(newValue, 10) as OverlayLevel;
      this.observer.setLevel(this.level);
    }

    if (name === "sample-interval") {
      this.sampleInterval = parseInt(newValue, 10) || 500;
    }

    if (name === "popover") {
      this.popover = newValue;
    }

    // Re-render to show/hide level 2 content
    if (this.isConnected) {
      this.render();
    }
  }

  setSampleInterval(ms: number): void {
    this.setAttribute("sample-interval", String(ms));
  }

  getSampleInterval(): number {
    return this.sampleInterval;
  }

  setLevel(level: OverlayLevel): void {
    this.setAttribute("level", String(level));
  }

  getLevel(): OverlayLevel {
    return this.level;
  }

  setPosition(position: "top" | "bottom"): void {
    this.setAttribute("position", position);
  }

  getPosition(): "top" | "bottom" {
    return (this.getAttribute("position") as "top" | "bottom") || "top";
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

  private toggleSettings = (e: Event): void => {
    e.stopPropagation();
    this.settingsOpen = !this.settingsOpen;
    this.render();
  };

  private handleLevelChange =
    (newLevel: OverlayLevel) =>
    (e: Event): void => {
      e.stopPropagation();
      this.setLevel(newLevel);
    };

  private handlePositionChange =
    (newPosition: "top" | "bottom") =>
    (e: Event): void => {
      e.stopPropagation();
      this.setPosition(newPosition);
    };

  private handleIntervalChange = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value >= 50 && value <= 5000) {
      this.setSampleInterval(value);
    }
  };

  private formatRam(mb: number): { value: string; unit: string } {
    if (mb >= 1024) {
      const gib = mb / 1024;
      // Show decimal only if needed (e.g., 1.5GiB but not 2.0GiB)
      return {
        value: gib % 1 === 0 ? String(Math.round(gib)) : gib.toFixed(1),
        unit: "GiB",
      };
    }
    return { value: String(Math.round(mb)), unit: "MiB" };
  }

  private getCpuClass(cpuLoad: number): string {
    if (cpuLoad <= 50) return "cpu-low";
    if (cpuLoad <= 75) return "cpu-mid";
    if (cpuLoad <= 90) return "cpu-high";
    return "cpu-crit";
  }

  private getFpsClass(fps: number, targetFps: number): string {
    const ratio = fps / targetFps;
    if (ratio >= 0.95) return "fps-good";
    if (ratio >= 0.75) return "fps-warn";
    return "fps-bad";
  }

  private getLevelIndicatorClass(): string {
    if (this.level === 0) return "off";
    if (this.level === 1) return "basic";
    return "detailed";
  }

  private render(): void {
    const metrics = this.observer.getMetrics();
    const fpsClass = this.getFpsClass(metrics.fps, metrics.targetFps);
    const ram = metrics.ramUsed !== undefined ? this.formatRam(metrics.ramUsed) : null;
    const position = this.getPosition();
    const isCollapsed = this.level === 0;

    const settingsDropdown = html`
      <div class="settings-dropdown ${this.settingsOpen ? "open" : ""}">
        <div class="settings-group">
          <div class="settings-label">Level</div>
          <div class="level-selector">
            <button 
              class="level-btn ${this.level === 0 ? "selected" : ""}" 
              @click=${this.handleLevelChange(0)}
            >Off</button>
            <button 
              class="level-btn ${this.level === 1 ? "selected" : ""}" 
              @click=${this.handleLevelChange(1)}
            >Basic</button>
            <button 
              class="level-btn ${this.level === 2 ? "selected" : ""}" 
              @click=${this.handleLevelChange(2)}
            >Detailed</button>
          </div>
        </div>
        
        <div class="settings-group">
          <div class="settings-label">Position</div>
          <div class="position-toggle">
            <button 
              class="position-btn ${position === "top" ? "selected" : ""}" 
              @click=${this.handlePositionChange("top")}
            >${topIcon} Top</button>
            <button 
              class="position-btn ${position === "bottom" ? "selected" : ""}" 
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
              .value=${String(this.sampleInterval)}
              min="50"
              max="5000"
              step="50"
              @change=${this.handleIntervalChange}
            />
            <span class="interval-unit">ms</span>
          </div>
        </div>
      </div>
    `;

    const settingsButton = html`
      <div class="settings-wrapper">
        <div class="level-indicator ${this.getLevelIndicatorClass()}"></div>
        <button 
          class="settings-btn ${this.settingsOpen ? "active" : ""}" 
          @click=${this.toggleSettings}
          title="Performance Settings"
        >${gearIcon}</button>
        ${settingsDropdown}
      </div>
    `;

    const template = html`
      <style>${styles}</style>
      <div class="overlay ${isCollapsed ? "collapsed" : ""}" id="container">
        <svg class="isolate-layout" width="100%" height="100%"> 
          <foreignObject width="100%" height="100%">
            ${
              isCollapsed
                ? settingsButton
                : html`
                <div class="overlay-content">
                  <!-- Section 1: FPS -->
                  <div class="section">
                    <div class="stat">
                      <span class="label">FPS</span>
                      <span class="value value-3 ${fpsClass}">${metrics.fps}</span>
                    </div>
                    <div class="stat">
                      <span class="value hz">${metrics.targetFps}</span>
                      <span class="unit">Hz</span>
                    </div>
                  </div>

                  ${
                    this.level === 2
                      ? html`
                      <!-- Section 2: Frametime Graph -->
                      <div class="section">
                        <canvas id="graph" class="graph-canvas" width=${this.canvasWidth * this.dpr} height=${this.canvasHeight * this.dpr} style="--canvas-width: ${this.canvasWidth}px; --canvas-height: ${this.canvasHeight}px;"></canvas>
                      </div>

                      <!-- Section 3: CPU + FT -->
                      ${
                        metrics.cpuLoad !== undefined
                          ? html`
                          <div class="section">
                            <div class="stat">
                              <span class="label">CPU</span>
                              <span class="value value-3 ${this.getCpuClass(metrics.cpuLoad)}">${metrics.cpuLoad}</span>
                              <span class="unit">%</span>
                            </div>
                            <div class="stat">
                              <span class="label">FT</span>
                              <span class="value value-5 ft">${metrics.frameTime.toFixed(1)}</span>
                              <span class="unit">ms</span>
                            </div>
                          </div>
                        `
                          : nothing
                      }

                      <!-- Section 4: GPU -->
                      <div class="section">
                        <div class="stat">
                          <span class="label">GPU</span>
                          <span class="value value-3" style="color:#555">N/A</span>
                        </div>
                      </div>

                      <!-- Section 5: RAM -->
                      ${
                        ram
                          ? html`
                          <div class="section">
                            <div class="stat">
                              <span class="label">RAM</span>
                              <span class="value value-5 ram">${ram.value}</span>
                              <span class="unit">${ram.unit}</span>
                            </div>
                          </div>
                        `
                          : nothing
                      }
                    `
                      : nothing
                  }
                </div>
                ${settingsButton}
              `
            }
          </foreignObject>
        </svg>
      </div>
    `;

    render(template, this.shadowRoot);

    // Get references after DOM update
    if (this.level === 2) {
      this.canvas = this.shadowRoot.getElementById("graph") as HTMLCanvasElement;
      if (this.canvas) {
        this.ctx = this.canvas.getContext("2d")!;
      }
    }
  }

  private drawGraph(targetFps: number): void {
    const canvas = this.canvas;
    const width = this.canvasWidth;
    const height = this.canvasHeight;
    const dpr = this.dpr;
    const ctx = this.ctx;

    if (!canvas || !ctx) return;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const history = this.observer.getHistory();
    const { data, index, count } = history;
    if (count < 2) return;

    // Frame time thresholds (ms)
    const targetMs = 1000 / targetFps;
    const sixtyMs = 1000 / 60;
    const thirtyMs = 1000 / 30;
    const maxMs = 50;

    // Draw threshold lines
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    const targetY = height - (targetMs / maxMs) * height;
    ctx.strokeStyle = "rgba(34, 197, 94, 0.3)";
    ctx.beginPath();
    ctx.moveTo(0, targetY);
    ctx.lineTo(width, targetY);
    ctx.stroke();

    const sixtyY = height - (sixtyMs / maxMs) * height;
    ctx.strokeStyle = "rgba(234, 179, 8, 0.3)";
    ctx.beginPath();
    ctx.moveTo(0, sixtyY);
    ctx.lineTo(width, sixtyY);
    ctx.stroke();

    const thirtyY = height - (thirtyMs / maxMs) * height;
    ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
    ctx.beginPath();
    ctx.moveTo(0, thirtyY);
    ctx.lineTo(width, thirtyY);
    ctx.stroke();

    ctx.setLineDash([]);

    // Draw frame time history
    const samplesToShow = Math.min(count, 600);
    const step = width / samplesToShow;
    const startIdx = (index - samplesToShow + data.length) % data.length;

    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let prevX = 0;
    let prevY = 0;

    for (let i = 0; i < samplesToShow; i++) {
      const bufIdx = (startIdx + i) % data.length;
      const frameTime = Math.min(data[bufIdx], maxMs);
      const x = i * step;
      const y = height - (frameTime / maxMs) * height;

      let color: string;
      if (frameTime <= targetMs) {
        color = "#22c55e";
      } else if (frameTime <= sixtyMs) {
        color = "#3b82f6";
      } else if (frameTime <= thirtyMs) {
        color = "#eab308";
      } else {
        color = "#ef4444";
      }

      if (i > 0) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      prevX = x;
      prevY = y;
    }
  }
}

customElements.define("performance-overlay", PerformanceOverlay);
