import { getDB, getLastMetricTime, setLastMetricTime } from "./index";
import type { Metric, LogEntry, LogLevel, ServerStatus } from "./schema";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SIMULATION_INTERVAL = 10000; // 10 seconds
const PRUNE_INTERVAL = 30_000; // 30 seconds
const MAX_METRICS_AGE = 24 * 60 * 60 * 1000; // 24 hours
const MAX_BACKFILL_GAP = 60 * 60 * 1000; // 1 hour

const SERVICES = ["nginx", "postgres", "redis", "api-gateway", "auth-service", "worker", "cron"];
const LOG_MESSAGES: Record<LogLevel, string[]> = {
  debug: [
    "Connection pool stats updated",
    "Cache invalidated for key",
    "Request completed successfully",
    "Background task finished",
    "Health probe responded",
  ],
  info: [
    "New client connection",
    "Configuration applied",
    "Scheduled task started",
    "Metrics exported",
    "Session renewed",
  ],
  warn: [
    "Memory usage above threshold",
    "Connection timeout, retrying",
    "Rate limit reached",
    "Queue backlog growing",
    "Disk usage warning",
  ],
  error: [
    "Failed to connect to upstream",
    "Transaction rolled back",
    "Authentication failed",
    "Service timeout",
    "Resource exhausted",
  ],
  critical: [
    "System memory critical",
    "Database connection pool exhausted",
    "Service crashed, restarting",
    "Disk full",
    "Circuit breaker opened",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

const serverStates = new Map<string, { cpu: number; mem: number }>();
let simulationTimer: ReturnType<typeof setInterval> | null = null;
let pruneTimer: ReturnType<typeof setInterval> | null = null;
let isPaused = false;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedLogLevel(): LogLevel {
  const r = Math.random();
  if (r < 0.3) return "debug";
  if (r < 0.7) return "info";
  if (r < 0.88) return "warn";
  if (r < 0.97) return "error";
  return "critical";
}

function deriveStatus(cpu: number, mem: number): ServerStatus {
  if (cpu > 95 || mem > 95) return "critical";
  if (cpu > 80 || mem > 85) return "warning";
  return "healthy";
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Simulation
// ─────────────────────────────────────────────────────────────────────────────

async function simulateTick(timestamp: number): Promise<void> {
  const db = await getDB();
  const servers = await db.getAll("servers");

  // Initialize states for new servers
  for (const server of servers) {
    if (!serverStates.has(server.id)) {
      serverStates.set(server.id, {
        cpu: randomFloat(10, 40),
        mem: randomFloat(30, 60),
      });
    }
  }

  const metrics: Metric[] = [];
  const logs: LogEntry[] = [];
  const serverUpdates: { id: string; status: ServerStatus; lastSeen: number }[] = [];

  for (const server of servers) {
    if (server.status === "offline") continue;

    const state = serverStates.get(server.id)!;

    // Random walk CPU/memory
    state.cpu = Math.max(0, Math.min(100, state.cpu + randomFloat(-3, 3)));
    state.mem = Math.max(0, Math.min(100, state.mem + randomFloat(-1, 1)));

    // Occasional spikes
    if (Math.random() < 0.01) {
      state.cpu = Math.min(100, state.cpu + randomFloat(15, 30));
    }
    if (Math.random() < 0.005) {
      state.mem = Math.min(100, state.mem + randomFloat(10, 20));
    }

    metrics.push({
      id: `${server.id}-${timestamp}`,
      serverId: server.id,
      timestamp,
      cpu: Math.round(state.cpu * 10) / 10,
      memory: Math.round(state.mem * 10) / 10,
      networkIn: Math.round(randomFloat(100, 5000) * 100) / 100,
      networkOut: Math.round(randomFloat(50, 3000) * 100) / 100,
      diskRead: Math.round(randomFloat(0, 500) * 100) / 100,
      diskWrite: Math.round(randomFloat(0, 300) * 100) / 100,
    });

    // Update server status based on metrics
    const newStatus = deriveStatus(state.cpu, state.mem);
    if (newStatus !== server.status) {
      serverUpdates.push({ id: server.id, status: newStatus, lastSeen: timestamp });
    }

    // Generate random logs (0-3 per tick across all servers)
    if (Math.random() < 0.03) {
      const level = weightedLogLevel();
      logs.push({
        id: crypto.randomUUID(),
        serverId: server.id,
        timestamp,
        level,
        message: randomChoice(LOG_MESSAGES[level]),
        service: randomChoice(SERVICES),
        metadata:
          Math.random() < 0.3
            ? {
                requestId: crypto.randomUUID().slice(0, 8),
                duration: Math.floor(Math.random() * 500),
              }
            : undefined,
      });
    }
  }

  // Batch write metrics
  if (metrics.length > 0) {
    const metricsTx = db.transaction("metrics", "readwrite");
    for (const metric of metrics) {
      await metricsTx.store.put(metric);
    }
    await metricsTx.done;
  }

  // Batch write logs
  if (logs.length > 0) {
    const logsTx = db.transaction("logs", "readwrite");
    for (const log of logs) {
      await logsTx.store.put(log);
    }
    await logsTx.done;
  }

  // Update server statuses
  if (serverUpdates.length > 0) {
    const serversTx = db.transaction("servers", "readwrite");
    for (const update of serverUpdates) {
      const server = await serversTx.store.get(update.id);
      if (server) {
        server.status = update.status;
        server.lastSeen = update.lastSeen;
        await serversTx.store.put(server);
      }
    }
    await serversTx.done;
  }

  await setLastMetricTime(timestamp);
}

async function runSimulation(): Promise<void> {
  if (isPaused) return;

  const now = Date.now();
  const lastTime = await getLastMetricTime();

  // Backfill if needed
  if (lastTime && now - lastTime > 2000) {
    const gap = Math.min(now - lastTime, MAX_BACKFILL_GAP);
    const startTime = now - gap;
    console.log(`[Simulation] Backfilling ${Math.round(gap / 1000)}s gap`);

    for (let t = startTime; t < now; t += SIMULATION_INTERVAL) {
      await simulateTick(t);
    }
  }

  await simulateTick(now);
}

async function pruneOldData(): Promise<void> {
  const db = await getDB();
  const cutoff = Date.now() - MAX_METRICS_AGE;

  // Prune old metrics
  const metricsTx = db.transaction("metrics", "readwrite");
  const metricsIndex = metricsTx.store.index("by-timestamp");
  let metricsCursor = await metricsIndex.openCursor(IDBKeyRange.upperBound(cutoff));
  let metricsDeleted = 0;

  while (metricsCursor) {
    await metricsCursor.delete();
    metricsDeleted++;
    metricsCursor = await metricsCursor.continue();
  }
  await metricsTx.done;

  // Prune old logs (keep last 24h)
  const logsTx = db.transaction("logs", "readwrite");
  const logsIndex = logsTx.store.index("by-timestamp");
  let logsCursor = await logsIndex.openCursor(IDBKeyRange.upperBound(cutoff));
  let logsDeleted = 0;

  while (logsCursor) {
    await logsCursor.delete();
    logsDeleted++;
    logsCursor = await logsCursor.continue();
  }
  await logsTx.done;

  if (metricsDeleted > 0 || logsDeleted > 0) {
    console.log(`[Simulation] Pruned ${metricsDeleted} metrics, ${logsDeleted} logs`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function startSimulation(): void {
  if (simulationTimer) return;

  console.log("[Simulation] Starting...");
  isPaused = false;

  simulationTimer = setInterval(() => {
    void runSimulation();
  }, SIMULATION_INTERVAL);

  pruneTimer = setInterval(() => {
    void pruneOldData();
  }, PRUNE_INTERVAL);

  // Run immediately
  void runSimulation();
}

export function stopSimulation(): void {
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }
  if (pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = null;
  }
  console.log("[Simulation] Stopped");
}

export function pauseSimulation(): void {
  isPaused = true;
  console.log("[Simulation] Paused");
}

export function resumeSimulation(): void {
  isPaused = false;
  console.log("[Simulation] Resumed");
}

export function isSimulationRunning(): boolean {
  return simulationTimer !== null && !isPaused;
}
