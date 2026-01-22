import "../PerformanceOverlay";

import type { PerformanceOverlay as PerfOverlay, OverlayLevel } from "../index";

// Get DOM elements
const overlay = document.querySelector("performance-overlay") as PerfOverlay;
const canvas = document.getElementById("bench-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

// State
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
}

const state = {
  particles: [] as Particle[],
  particleCount: 5000,
  computeLoad: 5,
  domNodeCount: 100,
  benchmarks: {
    particles: false,
    compute: false,
    dom: false,
    memory: false,
  },
  domContainer: null as HTMLDivElement | null,
  memoryArrays: [] as Uint8Array[],
};

// Resize canvas
function resizeCanvas() {
  const rect = canvas.parentElement!.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.scale(devicePixelRatio, devicePixelRatio);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Initialize particles
function initParticles(count: number) {
  state.particles = [];
  const rect = canvas.parentElement!.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x: Math.random() * rect.width,
      y: Math.random() * rect.height,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      size: Math.random() * 3 + 1,
      hue: Math.random() * 360,
    });
  }
}

// Particle benchmark
function updateParticles() {
  if (!state.benchmarks.particles) return;

  const rect = canvas.parentElement!.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  ctx.fillStyle = "rgba(10, 10, 15, 0.1)";
  ctx.fillRect(0, 0, width, height);

  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy;

    // Bounce off walls
    if (p.x < 0 || p.x > width) p.vx *= -1;
    if (p.y < 0 || p.y > height) p.vy *= -1;

    // Keep in bounds
    p.x = Math.max(0, Math.min(width, p.x));
    p.y = Math.max(0, Math.min(height, p.y));

    // Draw
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, 0.8)`;
    ctx.fill();

    // Slowly change color
    p.hue = (p.hue + 0.5) % 360;
  }
}

// Heavy compute benchmark (blocks main thread)
let computeResult = 0;
const computeResultEl = document.createElement("div");
computeResultEl.id = "compute-result";
computeResultEl.style.cssText = `
  position: fixed;
  bottom: 8px;
  right: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #555;
  pointer-events: none;
`;
document.body.appendChild(computeResultEl);

function heavyCompute() {
  if (!state.benchmarks.compute || state.computeLoad === 0) {
    computeResultEl.textContent = "";
    return;
  }

  const start = performance.now();
  const target = state.computeLoad;

  // Busy loop to simulate heavy computation
  while (performance.now() - start < target) {
    // Perform some meaningless but CPU-intensive work
    for (let i = 0; i < 10000; i++) {
      computeResult += Math.sqrt(i) * Math.sin(i);
    }
  }

  // Render to DOM to prevent optimization
  computeResultEl.textContent = `compute: ${computeResult.toFixed(2)}`;
}

// DOM stress benchmark
function domStress() {
  if (!state.benchmarks.dom) {
    // Cleanup if stopped
    if (state.domContainer) {
      state.domContainer.remove();
      state.domContainer = null;
    }
    return;
  }

  if (!state.domContainer) {
    state.domContainer = document.createElement("div");
    state.domContainer.style.cssText = `
      position: fixed;
      bottom: 60px;
      left: 24px;
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      max-width: 300px;
      pointer-events: none;
      opacity: 0.5;
    `;
    document.body.appendChild(state.domContainer);
  }

  // Remove all children
  state.domContainer.innerHTML = "";

  // Create new nodes
  for (let i = 0; i < state.domNodeCount; i++) {
    const node = document.createElement("div");
    node.style.cssText = `
      width: 8px;
      height: 8px;
      background: hsl(${(i * 3) % 360}, 60%, 50%);
      border-radius: 2px;
    `;
    state.domContainer.appendChild(node);
  }

  updateStatus();
}

// Memory churn benchmark
function memoryChurn() {
  if (!state.benchmarks.memory) {
    state.memoryArrays = [];
    return;
  }

  // Randomly allocate or release memory
  if (Math.random() > 0.3 && state.memoryArrays.length < 100) {
    // Allocate 1MB
    state.memoryArrays.push(new Uint8Array(1024 * 1024));
  } else if (state.memoryArrays.length > 0) {
    // Release random array
    const idx = Math.floor(Math.random() * state.memoryArrays.length);
    state.memoryArrays.splice(idx, 1);
  }
}

// Animation loop
function loop() {
  updateParticles();
  heavyCompute();
  domStress();
  memoryChurn();
  requestAnimationFrame(loop);
}

// Start the loop
initParticles(state.particleCount);
loop();

// UI Controls
function setupControls() {
  // Level buttons
  const levelBtns = ["level-0", "level-1", "level-2"];
  levelBtns.forEach((id, level) => {
    const btn = document.getElementById(id)!;
    btn.addEventListener("click", () => {
      levelBtns.forEach((btnId) => document.getElementById(btnId)!.classList.remove("active"));
      btn.classList.add("active");
      overlay.setLevel(level as OverlayLevel);
    });
  });

  // Position buttons
  const posTop = document.getElementById("pos-top")!;
  const posBottom = document.getElementById("pos-bottom")!;

  posTop.addEventListener("click", () => {
    posTop.classList.add("active");
    posBottom.classList.remove("active");
    overlay.removeAttribute("position");
    document.body.style.paddingTop = "24px";
    document.body.style.paddingBottom = "0";
  });

  posBottom.addEventListener("click", () => {
    posBottom.classList.add("active");
    posTop.classList.remove("active");
    overlay.setAttribute("position", "bottom");
    document.body.style.paddingTop = "0";
    document.body.style.paddingBottom = "24px";
  });

  // Benchmark toggles
  function setupBenchToggle(
    btnId: string,
    benchKey: keyof typeof state.benchmarks,
    onStart?: () => void,
  ) {
    const btn = document.getElementById(btnId)!;
    btn.addEventListener("click", () => {
      state.benchmarks[benchKey] = !state.benchmarks[benchKey];
      btn.textContent = state.benchmarks[benchKey] ? "Stop" : "Start";
      btn.classList.toggle("success", !state.benchmarks[benchKey]);
      btn.classList.toggle("danger", state.benchmarks[benchKey]);
      if (state.benchmarks[benchKey] && onStart) {
        onStart();
      }
      updateStatus();
    });
  }

  setupBenchToggle("bench-particles", "particles", () => initParticles(state.particleCount));
  setupBenchToggle("bench-compute", "compute");
  setupBenchToggle("bench-dom", "dom");
  setupBenchToggle("bench-memory", "memory");

  // All benchmarks button
  document.getElementById("bench-all")!.addEventListener("click", () => {
    const allRunning = Object.values(state.benchmarks).every((v) => v);
    const keys = Object.keys(state.benchmarks) as (keyof typeof state.benchmarks)[];

    keys.forEach((key) => {
      state.benchmarks[key] = !allRunning;
    });

    // Update all buttons
    document.querySelectorAll('[id^="bench-"]:not(#bench-all)').forEach((btn) => {
      const el = btn as HTMLButtonElement;
      el.textContent = allRunning ? "Start" : "Stop";
      el.classList.toggle("success", allRunning);
      el.classList.toggle("danger", !allRunning);
    });

    const allBtn = document.getElementById("bench-all")!;
    allBtn.textContent = allRunning ? "Start All" : "Stop All";

    if (!allRunning) {
      initParticles(state.particleCount);
    }

    updateStatus();
  });

  // Sliders
  const particleSlider = document.getElementById("particle-count") as HTMLInputElement;
  const particleValue = document.getElementById("particle-count-value")!;
  particleSlider.addEventListener("input", () => {
    state.particleCount = parseInt(particleSlider.value);
    particleValue.textContent = state.particleCount.toLocaleString();
    if (state.benchmarks.particles) {
      initParticles(state.particleCount);
    }
  });

  const computeSlider = document.getElementById("compute-load") as HTMLInputElement;
  const computeValue = document.getElementById("compute-load-value")!;
  computeSlider.addEventListener("input", () => {
    state.computeLoad = parseInt(computeSlider.value);
    computeValue.textContent = `${state.computeLoad}`;
  });

  const domSlider = document.getElementById("dom-nodes") as HTMLInputElement;
  const domValue = document.getElementById("dom-nodes-value")!;
  domSlider.addEventListener("input", () => {
    state.domNodeCount = parseInt(domSlider.value);
    domValue.textContent = state.domNodeCount.toLocaleString();
  });
}

function updateStatus() {
  const activeCount = Object.values(state.benchmarks).filter((v) => v).length;
  document.getElementById("active-count")!.textContent = String(activeCount);
  document.getElementById("particle-status")!.textContent = state.benchmarks.particles
    ? state.particles.length.toLocaleString()
    : "0";
  document.getElementById("dom-status")!.textContent = state.benchmarks.dom
    ? state.domNodeCount.toLocaleString()
    : "0";
}

setupControls();
updateStatus();

// Start particles by default
state.benchmarks.particles = true;
document.getElementById("bench-particles")!.textContent = "Stop";
document.getElementById("bench-particles")!.classList.remove("success");
document.getElementById("bench-particles")!.classList.add("danger");
updateStatus();
