export type OverlayLevel = 0 | 1 | 2;

export interface PerformanceMetrics {
  fps: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  frameTime: number;
  targetFps: number;
  // Level 2 metrics
  cpuLoad?: number; // Main thread blocking estimate (0-100)
  gpuLoad?: number; // Not available in browsers, always undefined
  ramUsed?: number; // MB (Chrome only via performance.memory)
  ramTotal?: number; // MB (Chrome only)
  jankCount: number;
}

export interface PerformanceObserverOptions {
  level?: OverlayLevel;
  sampleSize?: number;
  jankThreshold?: number;
  onUpdate?: (metrics: PerformanceMetrics) => void;
}

// Modern memory measurement API
interface MemoryAttribution {
  url: string;
  scope: string;
  container?: {
    id: string;
    src: string;
  };
}

interface MemoryBreakdownEntry {
  bytes: number;
  attribution: MemoryAttribution[];
  types: string[];
}

interface MemoryMeasurement {
  bytes: number;
  breakdown: MemoryBreakdownEntry[];
}

interface PerformanceWithMemory extends Performance {
  measureUserAgentSpecificMemory?: () => Promise<MemoryMeasurement>;
  // Fallback to legacy API
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export class PerformanceObserver {
  private level: OverlayLevel;
  private sampleSize: number;
  private jankThreshold: number;
  private onUpdate?: (metrics: PerformanceMetrics) => void;

  private frameTimes: Float64Array;
  private frameIndex = 0;
  private frameCount = 0;
  private lastFrameTime = 0;
  private jankCount = 0;
  private rafId: number = -1;
  private detectRafId: number = -1;
  private updateCounter = 0;
  private targetFps = 120;
  private isRunning = false;

  // CPU load estimation
  private cpuSamples: Float64Array;
  private cpuIndex = 0;
  private cpuCount = 0;
  private expectedFrameTime = 0;

  // Frame time history for graph (~10 seconds at 120fps)
  private static readonly HISTORY_SIZE = 1200;
  private _frameTimeHistory = new Float64Array(PerformanceObserver.HISTORY_SIZE);
  private _historyIndex = 0;
  private _historyCount = 0;

  // Memory measurement
  private lastMemoryMeasurement = 0;
  private memoryMeasurementInterval = 2000; // Measure every 2 seconds
  private isMemoryMeasuring = false;
  private cachedMemoryUsed: number | undefined;

  private metrics: PerformanceMetrics = {
    fps: 0,
    avgFps: 0,
    minFps: 0,
    maxFps: 0,
    frameTime: 0,
    targetFps: 120,
    jankCount: 0,
  };

  constructor(options: PerformanceObserverOptions = {}) {
    this.level = options.level ?? 1;
    this.sampleSize = options.sampleSize ?? 30;
    this.jankThreshold = options.jankThreshold ?? 50;
    this.onUpdate = options.onUpdate;

    this.frameTimes = new Float64Array(this.sampleSize);
    this.cpuSamples = new Float64Array(this.sampleSize);
  }

  getLevel(): OverlayLevel {
    return this.level;
  }

  setLevel(level: OverlayLevel): void {
    this.level = level;
    if (level === 0) {
      this.stop();
    } else if (!this.isRunning) {
      this.start();
    }
  }

  getMetrics(): PerformanceMetrics {
    return this.metrics;
  }

  /** Get frame time history for graph rendering */
  getHistory(): { data: Float64Array; index: number; count: number } {
    return {
      data: this._frameTimeHistory,
      index: this._historyIndex,
      count: this._historyCount,
    };
  }

  getTargetFps(): number {
    return this.targetFps;
  }

  start(): void {
    if (this.isRunning || this.level === 0) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.detectRefreshRate();
    this.rafId = requestAnimationFrame(this.measure);
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafId !== -1) {
      cancelAnimationFrame(this.rafId);
      this.rafId = -1;
    }
  }

  destroy(): void {
    this.stop();
    if (this.detectRafId !== -1) {
      cancelAnimationFrame(this.detectRafId);
      this.detectRafId = -1;
    }
    this.onUpdate = undefined;
  }

  private detectRefreshRate(): void {
    if (this.detectRafId !== -1) return; // Already detecting

    let times: number[] = [];

    const detect = (now: number): void => {
      if (!this.isRunning) {
        this.detectRafId = -1;
        return;
      }

      times.push(now);
      if (times.length > 60) {
        const diffs = times.slice(1).map((t, i) => t - times[i]);
        const avg = diffs.reduce((a, b) => a + b) / diffs.length;
        const hz = Math.round(1000 / avg);

        // Round to common refresh rates
        if (hz >= 200) this.targetFps = 240;
        else if (hz >= 155) this.targetFps = 165;
        else if (hz >= 135) this.targetFps = 144;
        else if (hz >= 100) this.targetFps = 120;
        else if (hz >= 80) this.targetFps = 90;
        else if (hz >= 65) this.targetFps = 75;
        else this.targetFps = 60;

        this.expectedFrameTime = 1000 / this.targetFps;
        this.detectRafId = -1;
        return;
      }
      this.detectRafId = requestAnimationFrame(detect);
    };

    this.detectRafId = requestAnimationFrame(detect);
  }

  private measure = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    if (delta > 0 && delta < 1000) {
      // Store frame time for averaging
      this.frameTimes[this.frameIndex] = delta;
      this.frameIndex = (this.frameIndex + 1) % this.sampleSize;
      if (this.frameCount < this.sampleSize) {
        this.frameCount++;
      }

      // Store in history for graph
      this._frameTimeHistory[this._historyIndex] = delta;
      this._historyIndex = (this._historyIndex + 1) % PerformanceObserver.HISTORY_SIZE;
      if (this._historyCount < PerformanceObserver.HISTORY_SIZE) {
        this._historyCount++;
      }

      // Jank detection
      if (delta > this.jankThreshold) {
        this.jankCount++;
      }

      // CPU load estimation (how much extra time beyond ideal frame time)
      // 0% = hitting target perfectly, 100% = taking 2x the expected time
      if (this.level === 2 && this.expectedFrameTime > 0) {
        const excess = delta - this.expectedFrameTime;
        const cpuEstimate = Math.max(0, Math.min(100, (excess / this.expectedFrameTime) * 100));
        this.cpuSamples[this.cpuIndex] = cpuEstimate;
        this.cpuIndex = (this.cpuIndex + 1) % this.sampleSize;
        if (this.cpuCount < this.sampleSize) {
          this.cpuCount++;
        }
      }

      // Update metrics every 3 frames
      this.updateCounter++;
      if (this.updateCounter >= 3 && this.frameCount > 0) {
        this.updateCounter = 0;
        this.computeMetrics(delta);
      }
    }

    this.rafId = requestAnimationFrame(this.measure);
  };

  private computeMetrics(currentDelta: number): void {
    const count = this.frameCount;
    let sum = 0;
    let minTime = this.frameTimes[0];
    let maxTime = this.frameTimes[0];

    for (let i = 0; i < count; i++) {
      const t = this.frameTimes[i];
      sum += t;
      if (t < minTime) minTime = t;
      if (t > maxTime) maxTime = t;
    }

    const avgFrameTime = sum / count;

    this.metrics = {
      fps: Math.round(1000 / currentDelta),
      avgFps: Math.round(1000 / avgFrameTime),
      minFps: Math.round(1000 / maxTime),
      maxFps: Math.min(999, Math.round(1000 / minTime)),
      frameTime: Math.round(currentDelta * 100) / 100,
      targetFps: this.targetFps,
      jankCount: this.jankCount,
    };

    // Level 2: Add extended metrics
    if (this.level === 2) {
      // CPU load estimation (average)
      if (this.cpuCount > 0) {
        let cpuSum = 0;
        for (let i = 0; i < this.cpuCount; i++) {
          cpuSum += this.cpuSamples[i];
        }
        this.metrics.cpuLoad = Math.round(cpuSum / this.cpuCount);
      }

      // RAM usage - use cached value, measure periodically
      if (this.cachedMemoryUsed !== undefined) {
        this.metrics.ramUsed = this.cachedMemoryUsed;
      }
      this.measureMemory();

      // GPU load is not available in browsers
      this.metrics.gpuLoad = undefined;
    }

    this.onUpdate?.(this.metrics);
  }

  private measureMemory(): void {
    const now = performance.now();

    // Only measure every N seconds to avoid overhead
    if (
      this.isMemoryMeasuring ||
      now - this.lastMemoryMeasurement < this.memoryMeasurementInterval
    ) {
      return;
    }

    this.lastMemoryMeasurement = now;
    this.isMemoryMeasuring = true;

    const perf = performance as PerformanceWithMemory;

    // Prefer modern API
    if (perf.measureUserAgentSpecificMemory) {
      perf
        .measureUserAgentSpecificMemory()
        .then((result) => {
          this.cachedMemoryUsed = Math.round(result.bytes / 1024 / 1024);
          this.isMemoryMeasuring = false;
        })
        .catch(() => {
          // Fallback to legacy API on error
          this.measureMemoryLegacy();
          this.isMemoryMeasuring = false;
        });
    } else {
      // Fallback to legacy API
      this.measureMemoryLegacy();
      this.isMemoryMeasuring = false;
    }
  }

  private measureMemoryLegacy(): void {
    const perf = performance as PerformanceWithMemory;
    if (perf.memory) {
      this.cachedMemoryUsed = Math.round(perf.memory.usedJSHeapSize / 1024 / 1024);
    }
  }
}
