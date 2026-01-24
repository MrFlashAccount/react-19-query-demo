import { html, render, nothing } from "lit-html";

import {
  PerformanceObserver as PerfObserver,
  type OverlayLevel,
  type PerformanceMetrics,
  type PerformanceObserverOptions,
} from "./PerformanceObserver";
import "./PerformanceSettings";
import type { PerformanceSettingsChangeEvent, OverlayPosition } from "./PerformanceSettings";
import { css } from "./utils";

export interface PerformanceOverlayOptions extends PerformanceObserverOptions {
  position?: OverlayPosition;
  sampleInterval?: number; // ms, default 500
}

const overlayHeight = 28;

const styles = css`
  :host {
    all: unset !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: transparent !important;
    pointer-events: none !important;

    display: block !important;
    font-family: "JetBrains Mono", "SF Mono", "Fira Code", "Cascadia Code", Menlo, Consolas, "DejaVu Sans Mono", monospace !important;
    font-size: 12px !important;
    line-height: 1 !important;
    left: 0 !important;
    right: 0 !important;
    user-select: none !important;
  }
  
  :host([position="bottom"]), :host([position="bottom"]) .overlay-content {
    bottom: 0 !important;
    top: auto !important;
    left: 0 !important;
    right: 0 !important;
  }

  :host([position="top"]), :host([position="top"]) .overlay-content {
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
  }
  
  :host([position="floating"]) .overlay-content,
  :host([position="pip"]) .overlay-content {
    left: auto;
    right: var(--floating-right, 4px);
    top: var(--floating-top, auto);
    bottom: var(--floating-bottom, 4px);
    width: auto;
    height: auto;
    border-radius: 20px;
    overflow: hidden;
  }
  :host([position="floating"]) .overlay-content {
    flex-direction: column;
    align-items: start;
    padding: 12px;
    cursor: grab;
  }
  :host([position="floating"][level="1"]) .overlay-content {
    padding: 8px 32px 8px 8px;
  }
  :host([position="floating"]) .overlay-content.dragging {
    cursor: grabbing;
  }
    
  .overlay {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0;
    padding: 0 8px 0 12px;
  }
  
  .overlay.collapsed {
    background: transparent;
    border: none;
    justify-content: flex-end;
    backdrop-filter: none;
  }
  
  :host([position="floating"]) .overlay-content,
  :host([position="pip"]) .overlay-content {
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }
  
  :host([position="floating"]), :host([position="floating"]) .overlay-content,
  :host([position="pip"]), :host([position="pip"]) .overlay-content {
    flex-wrap: nowrap;
    white-space: nowrap;
    width: auto;
  }
  
  :host([position="floating"]), :host([position="floating"]) .section,
  :host([position="pip"]), :host([position="pip"]) .section {
    border-right: none;
    padding: 0;
  }
  
  .overlay-content {
    position: fixed;
    pointer-events: auto;
    width: 100%;
    height: ${overlayHeight}px;
        display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(10, 10, 15, 0.92);
    backdrop-filter: blur(8px);
    corner-shape: superellipse(1.33);
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

  performance-settings {
    position: absolute;
    right: 0;
    top: 0;
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
    // Ensure position attribute is set for CSS selectors
    if (!this.hasAttribute("position")) {
      this.setAttribute("position", "top");
    }
    this.render();
    if (this.level > 0) {
      this.observer.start();
    }
    this.showPopover();
    window.addEventListener("resize", this.handleWindowResize);
  }

  disconnectedCallback(): void {
    this.observer.destroy();
    this.exitPip();
    // Clean up listeners
    document.removeEventListener("mousemove", this.handleDragMove);
    document.removeEventListener("mouseup", this.handleDragEnd);
    window.removeEventListener("resize", this.handleWindowResize);
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

  setPosition(position: OverlayPosition): void {
    const currentPosition = this.getPosition();

    // Exiting PIP mode
    if (currentPosition === "pip" && position !== "pip") {
      this.exitPip();
    }

    this.setAttribute("position", position);

    // Entering PIP mode
    if (position === "pip" && currentPosition !== "pip") {
      void this.enterPip();
    }
  }

  getPosition(): OverlayPosition {
    const pos = this.getAttribute("position");
    if (pos === "top" || pos === "bottom" || pos === "floating" || pos === "pip") {
      return pos;
    }
    return "top";
  }

  private pipWindow: Window | null = null;
  private isMovingToPip = false;

  // Drag state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private floatingRight = 4;
  private floatingBottom = 4;
  private floatingTop: number | null = null;
  private readonly SNAP_THRESHOLD = 8;
  private readonly EDGE_MARGIN = 4;

  private async enterPip(): Promise<void> {
    if (!("documentPictureInPicture" in window)) {
      console.warn("Document Picture-in-Picture not supported");
      return;
    }

    try {
      // @ts-expect-error - documentPictureInPicture is not yet in TypeScript types
      const pipWindow: Window = await window.documentPictureInPicture.requestWindow({
        width: 400,
        height: 60,
      });

      // Copy styles to PIP window
      const pipDocument = pipWindow.document;
      pipDocument.body.style.margin = "0";
      pipDocument.body.style.padding = "0";
      pipDocument.body.style.background = "transparent";

      // Handle PIP window close
      pipWindow.addEventListener("pagehide", () => {
        this.pipWindow = null;
        document.body.appendChild(this);
        this.setAttribute("position", "floating");
      });

      // Set flag before moving to prevent disconnectedCallback from closing PIP
      this.isMovingToPip = true;
      this.pipWindow = pipWindow;

      // Move overlay to PIP window
      pipDocument.body.appendChild(this);

      this.isMovingToPip = false;
    } catch (e) {
      console.error("Failed to enter PiP:", e);
      this.setAttribute("position", "floating");
    }
  }

  private exitPip(): void {
    if (this.pipWindow && !this.isMovingToPip) {
      this.pipWindow.close();
      this.pipWindow = null;
      document.body.appendChild(this);
    }
  }

  private handleDragStart = (e: MouseEvent): void => {
    if (this.getPosition() !== "floating") return;

    const target = e.target as HTMLElement;
    // Don't start drag if clicking on interactive elements
    if (target.closest("button, input, select, a, performance-settings")) return;

    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;

    const overlayContent = this.shadowRoot.querySelector(".overlay-content");
    overlayContent?.classList.add("dragging");

    document.addEventListener("mousemove", this.handleDragMove);
    document.addEventListener("mouseup", this.handleDragEnd);
    e.preventDefault();
  };

  private handleDragMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;

    const deltaX = this.dragStartX - e.clientX;
    const deltaY = this.dragStartY - e.clientY;

    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;

    const overlayContent = this.shadowRoot.querySelector(".overlay-content") as HTMLElement;
    if (!overlayContent) return;

    const rect = overlayContent.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    // Calculate new position
    let newRight = this.floatingRight + deltaX;
    let newBottom = this.floatingBottom + deltaY;

    // Constrain to viewport
    newRight = Math.max(
      this.EDGE_MARGIN,
      Math.min(viewportWidth - rect.width - this.EDGE_MARGIN, newRight),
    );
    newBottom = Math.max(
      this.EDGE_MARGIN,
      Math.min(viewportHeight - rect.height - this.EDGE_MARGIN, newBottom),
    );

    // Snap to edges
    const leftDist = viewportWidth - newRight - rect.width;
    const rightDist = newRight;
    const topDist = viewportHeight - newBottom - rect.height;
    const bottomDist = newBottom;

    // Snap horizontally
    if (leftDist < this.SNAP_THRESHOLD) {
      newRight = viewportWidth - rect.width - this.EDGE_MARGIN;
    } else if (rightDist < this.SNAP_THRESHOLD) {
      newRight = this.EDGE_MARGIN;
    }

    // Snap vertically
    if (topDist < this.SNAP_THRESHOLD) {
      newBottom = viewportHeight - rect.height - this.EDGE_MARGIN;
      this.floatingTop = this.EDGE_MARGIN;
    } else if (bottomDist < this.SNAP_THRESHOLD) {
      newBottom = this.EDGE_MARGIN;
      this.floatingTop = null;
    } else {
      this.floatingTop = null;
    }

    this.floatingRight = newRight;
    this.floatingBottom = newBottom;
    this.updateFloatingPosition();
  };

  private handleDragEnd = (): void => {
    this.isDragging = false;

    const overlayContent = this.shadowRoot.querySelector(".overlay-content");
    overlayContent?.classList.remove("dragging");

    document.removeEventListener("mousemove", this.handleDragMove);
    document.removeEventListener("mouseup", this.handleDragEnd);
  };

  private updateFloatingPosition(): void {
    const overlayContent = this.shadowRoot.querySelector(".overlay-content") as HTMLElement;
    if (!overlayContent) return;

    overlayContent.style.setProperty("--floating-right", `${this.floatingRight}px`);
    if (this.floatingTop !== null) {
      overlayContent.style.setProperty("--floating-top", `${this.floatingTop}px`);
      overlayContent.style.setProperty("--floating-bottom", "auto");
    } else {
      overlayContent.style.setProperty("--floating-top", "auto");
      overlayContent.style.setProperty("--floating-bottom", `${this.floatingBottom}px`);
    }
  }

  private handleWindowResize = (): void => {
    if (this.getPosition() !== "floating") return;

    const overlayContent = this.shadowRoot.querySelector(".overlay-content") as HTMLElement;
    if (!overlayContent) return;

    const rect = overlayContent.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    // Constrain to new viewport size
    this.floatingRight = Math.max(
      this.EDGE_MARGIN,
      Math.min(viewportWidth - rect.width - this.EDGE_MARGIN, this.floatingRight),
    );

    if (this.floatingTop !== null) {
      this.floatingTop = Math.max(
        this.EDGE_MARGIN,
        Math.min(viewportHeight - rect.height - this.EDGE_MARGIN, this.floatingTop),
      );
    } else {
      this.floatingBottom = Math.max(
        this.EDGE_MARGIN,
        Math.min(viewportHeight - rect.height - this.EDGE_MARGIN, this.floatingBottom),
      );
    }

    this.updateFloatingPosition();
  };

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
    // For bottom/floating/pip positions, dropdown opens upward
    const dropdownPosition = position === "top" ? "bottom" : "top";

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
                <div class="overlay-content" @mousedown=${this.handleDragStart}>
                  
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

                  ${settingsElement}

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
              `
            }
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
