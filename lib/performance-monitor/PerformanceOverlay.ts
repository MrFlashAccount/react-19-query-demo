import { html, render, nothing } from "lit-html";

import {
  PerformanceObserver as PerfObserver,
  type OverlayLevel,
  type PerformanceMetrics,
  type PerformanceObserverOptions,
} from "./PerformanceObserver";
import "./PerformanceSettings";
import type { PerformanceSettingsChangeEvent } from "./PerformanceSettings";
import { css } from "./utils";

export interface PerformanceOverlayOptions extends PerformanceObserverOptions {
  position?: "top" | "bottom";
  sampleInterval?: number; // ms, default 500
}

const overlayHeight = 24;

const styles = css`
  :host {
    all: unset;
    display: block;
    pointer-events: none;
    font-family: "JetBrains Mono", "SF Mono", "Fira Code", "Cascadia Code", Menlo, Consolas, "DejaVu Sans Mono", monospace;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    left: 0;
    right: 0;
    height: ${overlayHeight}px;
  }
  
  :host([position="bottom"]) {
    bottom: 0;
    top: auto;
  }
  :host(:not([position="bottom"])) {
    top: 0;
  }
  
  .isolate-layout {
    all: unset;
    pointer-events: none;
    width: 100%;
    height: ${overlayHeight}px;
    overflow: visible;
    overflow-clip-margin: unset;
    contain: content;
  }
  
  .overlay {
    display: flex;
    height: ${overlayHeight}px;
    align-items: center;
    justify-content: flex-start;
    gap: 0;
    padding: 0 8px 0 12px;
    background: rgba(10, 10, 15, 0.92);
  }
  
  .overlay.collapsed {
    background: transparent;
    border: none;
    justify-content: flex-end;
    backdrop-filter: none;
  }
  
  .overlay-content {
    width: 100%;
    height: ${overlayHeight}px;
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
    gap: 1ch;
  }
  
  .label {
    color: #666;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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
    document.documentElement.style.setProperty("--overlay-height", `${overlayHeight}px`);
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
  }

  disconnectedCallback(): void {
    this.observer.destroy();
  }

  private handleSettingsChange = (e: PerformanceSettingsChangeEvent): void => {
    const { level, position, sampleInterval } = e.detail;
    if (level !== undefined) this.setLevel(level);
    if (position !== undefined) this.setPosition(position);
    if (sampleInterval !== undefined) this.setSampleInterval(sampleInterval);
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

  private formatRam(mb: number): { value: string; unit: string } {
    if (mb >= 1024) {
      const gib = mb / 1024;
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

  private render(): void {
    const metrics = this.observer.getMetrics();
    const fpsClass = this.getFpsClass(metrics.fps, metrics.targetFps);
    const ram = metrics.ramUsed !== undefined ? this.formatRam(metrics.ramUsed) : null;
    const position = this.getPosition();
    const isCollapsed = this.level === 0;
    const dropdownPosition = position === "bottom" ? "top" : "bottom";

    const settingsElement = html`
      <performance-settings
        level=${this.level}
        position=${position}
        sample-interval=${this.sampleInterval}
        dropdown-position=${dropdownPosition}
        @settings-change=${this.handleSettingsChange}
      ></performance-settings>
    `;

    const template = html`
      <style>${styles}</style>
      <div class="overlay ${isCollapsed ? "collapsed" : ""}">
            ${
              isCollapsed
                ? nothing
                : html`
                  <svg class="isolate-layout" width="100%" height="100%">
  <foreignObject width="100%" height="100%">
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
                      <!-- Section 2: Frametime Graph + FT -->
                      <div class="section">
                        <canvas id="graph" class="graph-canvas" width=${this.canvasWidth * this.dpr} height=${this.canvasHeight * this.dpr} style="--canvas-width: ${this.canvasWidth}px; --canvas-height: ${this.canvasHeight}px;"></canvas>
                        <div class="stat">
                          <span class="value value-5 ft">${metrics.frameTime.toFixed(1)}</span>
                          <span class="unit">ms</span>
                        </div>
                      </div>

                      <!-- Section 3: CPU -->
                      ${
                        metrics.cpuLoad !== undefined
                          ? html`
                          <div class="section">
                            <div class="stat">
                              <span class="label">CPU</span>
                              <span class="value value-3 ${this.getCpuClass(metrics.cpuLoad)}">${metrics.cpuLoad}</span>
                              <span class="unit">%</span>
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
                  </foreignObject>
        </svg>  
              `
            }
            ${settingsElement}
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
    const maxSamples = 600;
    const step = width / maxSamples;
    const samplesToShow = Math.min(count, maxSamples);
    // Start from right, grow leftward as data arrives
    const xOffset = width - samplesToShow * step;
    const startIdx = (index - samplesToShow + data.length) % data.length;

    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let prevX = 0;
    let prevY = 0;

    for (let i = 0; i < samplesToShow; i++) {
      const bufIdx = (startIdx + i) % data.length;
      const frameTime = Math.min(data[bufIdx], maxMs);
      const x = xOffset + i * step;
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
