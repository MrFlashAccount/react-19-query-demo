import { getDB, isSeeded, markSeeded, setLastMetricTime } from "./index";
import type { Server, Metric, LogEntry, Alert, LogLevel, Region, ServerStatus } from "./schema";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SERVER_COUNT = 100;
const METRICS_HOURS = 24;
const METRICS_INTERVAL_MS = 60_000; // 1 minute
const LOG_COUNT = 10_000;
const ALERT_COUNT = 8;

const REGIONS: Region[] = ["us-east", "us-west", "eu-west", "eu-central", "asia-pacific"];
const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error", "critical"];
const SERVICES = ["nginx", "postgres", "redis", "api-gateway", "auth-service", "worker", "cron"];

const SERVER_PREFIXES = ["web", "api", "db", "cache", "worker", "gateway", "queue", "storage"];
const LOG_MESSAGES: Record<LogLevel, string[]> = {
  debug: [
    "Connection pool stats: active=5, idle=15",
    "Cache hit ratio: 94.2%",
    "Request processed in 12ms",
    "Garbage collection completed",
    "Health check passed",
  ],
  info: [
    "Server started successfully",
    "New connection established",
    "Configuration reloaded",
    "Backup completed",
    "Service deployment finished",
  ],
  warn: [
    "High memory usage detected",
    "Connection pool near capacity",
    "Slow query detected (>500ms)",
    "Rate limit approaching threshold",
    "Certificate expires in 7 days",
  ],
  error: [
    "Connection refused to upstream",
    "Failed to write to disk",
    "Authentication failure",
    "Query timeout exceeded",
    "Service unavailable",
  ],
  critical: [
    "Disk space critically low",
    "Out of memory",
    "Database connection lost",
    "SSL certificate expired",
    "System overload detected",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Random Helpers
// ─────────────────────────────────────────────────────────────────────────────

function randomId(): string {
  return crypto.randomUUID();
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomIp(): string {
  return `10.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
}

function weightedStatus(): ServerStatus {
  const r = Math.random();
  if (r < 0.85) return "healthy";
  if (r < 0.92) return "warning";
  if (r < 0.97) return "critical";
  return "offline";
}

function weightedLogLevel(): LogLevel {
  const r = Math.random();
  if (r < 0.3) return "debug";
  if (r < 0.7) return "info";
  if (r < 0.88) return "warn";
  if (r < 0.97) return "error";
  return "critical";
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate Servers
// ─────────────────────────────────────────────────────────────────────────────

function generateServers(): Server[] {
  const now = Date.now();
  const servers: Server[] = [];

  for (let i = 0; i < SERVER_COUNT; i++) {
    const prefix = randomChoice(SERVER_PREFIXES);
    const region = randomChoice(REGIONS);
    const regionCode = region.split("-")[0];

    servers.push({
      id: randomId(),
      name: `${prefix}-${regionCode}-${String(i + 1).padStart(3, "0")}`,
      ip: randomIp(),
      region,
      status: weightedStatus(),
      tags: [prefix, region],
      createdAt: now - randomInt(30, 365) * 24 * 60 * 60 * 1000,
      lastSeen: now - randomInt(0, 60) * 1000,
    });
  }

  return servers;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate Metrics
// ─────────────────────────────────────────────────────────────────────────────

function generateMetrics(servers: Server[]): Metric[] {
  const now = Date.now();
  const startTime = now - METRICS_HOURS * 60 * 60 * 1000;
  const metrics: Metric[] = [];

  // Track CPU/memory state per server for realistic progression
  const serverStates = new Map<string, { cpu: number; mem: number }>();

  for (const server of servers) {
    serverStates.set(server.id, {
      cpu: randomFloat(10, 40),
      mem: randomFloat(30, 60),
    });
  }

  for (let time = startTime; time <= now; time += METRICS_INTERVAL_MS) {
    for (const server of servers) {
      const state = serverStates.get(server.id)!;

      // Random walk for CPU and memory
      state.cpu = Math.max(0, Math.min(100, state.cpu + randomFloat(-5, 5)));
      state.mem = Math.max(0, Math.min(100, state.mem + randomFloat(-2, 2)));

      // Add occasional spikes
      if (Math.random() < 0.02) {
        state.cpu = Math.min(100, state.cpu + randomFloat(20, 40));
      }

      metrics.push({
        id: `${server.id}-${time}`,
        serverId: server.id,
        timestamp: time,
        cpu: Math.round(state.cpu * 10) / 10,
        memory: Math.round(state.mem * 10) / 10,
        networkIn: Math.round(randomFloat(100, 5000) * 100) / 100,
        networkOut: Math.round(randomFloat(50, 3000) * 100) / 100,
        diskRead: Math.round(randomFloat(0, 500) * 100) / 100,
        diskWrite: Math.round(randomFloat(0, 300) * 100) / 100,
      });
    }
  }

  return metrics;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate Logs
// ─────────────────────────────────────────────────────────────────────────────

function generateLogs(servers: Server[]): LogEntry[] {
  const now = Date.now();
  const logs: LogEntry[] = [];

  for (let i = 0; i < LOG_COUNT; i++) {
    const server = randomChoice(servers);
    const level = weightedLogLevel();
    const message = randomChoice(LOG_MESSAGES[level]);

    logs.push({
      id: randomId(),
      serverId: server.id,
      timestamp: now - randomInt(0, METRICS_HOURS * 60 * 60 * 1000),
      level,
      message,
      service: randomChoice(SERVICES),
      metadata:
        Math.random() < 0.3
          ? {
              requestId: randomId().slice(0, 8),
              duration: randomInt(1, 1000),
              statusCode: randomChoice([200, 201, 400, 404, 500, 502, 503]),
            }
          : undefined,
    });
  }

  // Sort by timestamp descending
  logs.sort((a, b) => b.timestamp - a.timestamp);
  return logs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate Default Alerts
// ─────────────────────────────────────────────────────────────────────────────

function generateAlerts(): Alert[] {
  const now = Date.now();
  return [
    {
      id: randomId(),
      name: "High CPU Usage",
      serverId: null,
      metric: "cpu",
      operator: ">",
      threshold: 80,
      duration: 300,
      enabled: true,
      createdAt: now,
    },
    {
      id: randomId(),
      name: "Critical CPU",
      serverId: null,
      metric: "cpu",
      operator: ">",
      threshold: 95,
      duration: 60,
      enabled: true,
      createdAt: now,
    },
    {
      id: randomId(),
      name: "Memory Warning",
      serverId: null,
      metric: "memory",
      operator: ">",
      threshold: 85,
      duration: 300,
      enabled: true,
      createdAt: now,
    },
    {
      id: randomId(),
      name: "Memory Critical",
      serverId: null,
      metric: "memory",
      operator: ">",
      threshold: 95,
      duration: 60,
      enabled: true,
      createdAt: now,
    },
    {
      id: randomId(),
      name: "High Network In",
      serverId: null,
      metric: "networkIn",
      operator: ">",
      threshold: 10000,
      duration: 300,
      enabled: true,
      createdAt: now,
    },
    {
      id: randomId(),
      name: "High Network Out",
      serverId: null,
      metric: "networkOut",
      operator: ">",
      threshold: 8000,
      duration: 300,
      enabled: true,
      createdAt: now,
    },
    {
      id: randomId(),
      name: "Low CPU Utilization",
      serverId: null,
      metric: "cpu",
      operator: "<",
      threshold: 5,
      duration: 3600,
      enabled: false,
      createdAt: now,
    },
    {
      id: randomId(),
      name: "Idle Memory",
      serverId: null,
      metric: "memory",
      operator: "<",
      threshold: 10,
      duration: 3600,
      enabled: false,
      createdAt: now,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed Database
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDatabase(): Promise<{ servers: number; metrics: number; logs: number }> {
  if (await isSeeded()) {
    console.log("[Seed] Database already seeded, skipping");
    return { servers: 0, metrics: 0, logs: 0 };
  }

  console.log("[Seed] Starting database seed...");
  const startTime = performance.now();

  const db = await getDB();

  // Generate data
  console.log("[Seed] Generating servers...");
  const servers = generateServers();

  console.log("[Seed] Generating metrics (this may take a moment)...");
  const metrics = generateMetrics(servers);

  console.log("[Seed] Generating logs...");
  const logs = generateLogs(servers);

  console.log("[Seed] Generating alerts...");
  const alerts = generateAlerts();

  // Insert in batches for better performance
  const BATCH_SIZE = 1000;

  // Insert servers
  console.log("[Seed] Inserting servers...");
  const serverTx = db.transaction("servers", "readwrite");
  for (const server of servers) {
    await serverTx.store.put(server);
  }
  await serverTx.done;

  // Insert metrics in batches
  console.log("[Seed] Inserting metrics...");
  for (let i = 0; i < metrics.length; i += BATCH_SIZE) {
    const batch = metrics.slice(i, i + BATCH_SIZE);
    const tx = db.transaction("metrics", "readwrite");
    for (const metric of batch) {
      await tx.store.put(metric);
    }
    await tx.done;
  }

  // Insert logs in batches
  console.log("[Seed] Inserting logs...");
  for (let i = 0; i < logs.length; i += BATCH_SIZE) {
    const batch = logs.slice(i, i + BATCH_SIZE);
    const tx = db.transaction("logs", "readwrite");
    for (const log of batch) {
      await tx.store.put(log);
    }
    await tx.done;
  }

  // Insert alerts
  console.log("[Seed] Inserting alerts...");
  const alertTx = db.transaction("alerts", "readwrite");
  for (const alert of alerts) {
    await alertTx.store.put(alert);
  }
  await alertTx.done;

  // Mark as seeded and record last metric time
  await markSeeded();
  await setLastMetricTime(Date.now());

  const duration = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(
    `[Seed] Complete in ${duration}s - ${servers.length} servers, ${metrics.length} metrics, ${logs.length} logs`,
  );

  return { servers: servers.length, metrics: metrics.length, logs: logs.length };
}
