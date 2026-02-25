import { setupWorker, http, json, error, noContent } from "@lib/rsc-service-worker-bff";
import { createClientModule } from "@lib/rsc-prism";
import { getDB, setLastMetricTime } from "@/db/index";
import {
  CreateServerSchema,
  UpdateServerSchema,
  AlertSchema,
  CreateAlertSchema,
  UpdateAlertSchema,
  LogQuerySchema,
  MetricQuerySchema,
  type Server,
  type Metric,
  type LogEntry,
  type DashboardStats,
} from "@/db/schema";
import { ServerBody } from "@/routes/Server/ServerRSC";
import type * as ClientComponents from "@/routes/Server/client-components";

// ─────────────────────────────────────────────────────────────────────────────
// RSC Client Module
// ─────────────────────────────────────────────────────────────────────────────

const { manifest, refs: Client } = createClientModule<typeof ClientComponents>(
  "server-monitoring",
  [
    "ServerSelectorWrapper",
    "ChartCard",
    "LogTimestampButton",
    "LogViewAtTimeButton",
    "LoadMoreButton",
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// Servers
// ─────────────────────────────────────────────────────────────────────────────

const getServers = http.get("/api/servers", async () => {
  const db = await getDB();
  const servers = await db.getAll("servers");
  return json(servers);
});

const getServer = http.get("/api/servers/:id", async ({ params }) => {
  const db = await getDB();
  const server = await db.get("servers", params.id);
  if (!server) return error("Server not found", 404);
  return json(server);
});

const createServer = http.post("/api/servers", async ({ request }) => {
  const body = await request.json();
  const result = CreateServerSchema.safeParse(body);
  if (!result.success) return error(result.error.message, 400);

  const now = Date.now();
  const server: Server = {
    id: crypto.randomUUID(),
    ...result.data,
    createdAt: now,
    lastSeen: now,
  };

  const db = await getDB();
  await db.put("servers", server);
  return json(server, { status: 201 });
});

const updateServer = http.patch("/api/servers/:id", async ({ params, request }) => {
  const db = await getDB();
  const existing = await db.get("servers", params.id);
  if (!existing) return error("Server not found", 404);

  const body = await request.json();
  const result = UpdateServerSchema.safeParse({ ...body, id: params.id });
  if (!result.success) return error(result.error.message, 400);

  const updated: Server = { ...existing, ...result.data };
  await db.put("servers", updated);
  return json(updated);
});

const deleteServer = http.delete("/api/servers/:id", async ({ params }) => {
  const db = await getDB();
  await db.delete("servers", params.id);
  return noContent();
});

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────

const getMetrics = http.post("/api/metrics/query", async ({ request }) => {
  const body = await request.json();

  // Parse time range if range param is provided
  let parsedBody = body;
  if (body.range && typeof body.range === "string") {
    const { parseTimeRange } = await import("@/utilities/timeRange");
    const parsed = parseTimeRange(body.range);
    if (parsed) {
      parsedBody = {
        ...body,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
      };
      delete parsedBody.range;
    }
  }

  // Handle "now" keyword
  if (parsedBody.endTime === "now") {
    parsedBody.endTime = Date.now();
  }

  const result = MetricQuerySchema.safeParse(parsedBody);
  if (!result.success) return error(result.error.message, 400);

  const { serverIds, startTime, endTime } = result.data;
  const db = await getDB();
  const metrics: Metric[] = [];

  for (const serverId of serverIds) {
    const range = IDBKeyRange.bound([serverId, startTime], [serverId, endTime]);
    const serverMetrics = await db.getAllFromIndex("metrics", "by-server-time", range);
    metrics.push(...serverMetrics);
  }

  // Sort by timestamp
  metrics.sort((a, b) => a.timestamp - b.timestamp);
  return json(metrics);
});

const getLatestMetrics = http.get("/api/metrics/latest", async ({ request }) => {
  const url = new URL(request.url);
  const serverIds = url.searchParams.get("serverIds")?.split(",") ?? [];

  const db = await getDB();
  const results: Record<string, Metric | null> = {};

  for (const serverId of serverIds) {
    const range = IDBKeyRange.bound([serverId, 0], [serverId, Date.now()]);
    const cursor = await db
      .transaction("metrics")
      .store.index("by-server-time")
      .openCursor(range, "prev");
    results[serverId] = cursor?.value ?? null;
  }

  return json(results);
});

// ─────────────────────────────────────────────────────────────────────────────
// Logs
// ─────────────────────────────────────────────────────────────────────────────

const getLogs = http.get("/api/logs", async ({ request }) => {
  const url = new URL(request.url);

  // Parse time range
  let parsedStartTime: number | undefined;
  let parsedEndTime: number | undefined;

  const rangeParam = url.searchParams.get("range");
  if (rangeParam) {
    const { parseTimeRange } = await import("@/utilities/timeRange");
    const parsed = parseTimeRange(rangeParam);
    if (parsed) {
      parsedStartTime = parsed.startTime;
      parsedEndTime = parsed.endTime;
    }
  } else {
    // Legacy numeric params
    const endTimeParam = url.searchParams.get("endTime");
    parsedEndTime =
      endTimeParam === "now" ? Date.now() : endTimeParam ? Number(endTimeParam) : undefined;
    const startTimeParam = url.searchParams.get("startTime");
    parsedStartTime = startTimeParam ? Number(startTimeParam) : undefined;
  }

  const queryResult = LogQuerySchema.safeParse({
    serverId: url.searchParams.get("serverId") ?? undefined,
    level: url.searchParams.get("level") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    startTime: parsedStartTime,
    endTime: parsedEndTime,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 100,
    offset: url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : 0,
  });

  if (!queryResult.success) return error(queryResult.error.message, 400);

  const { serverId, level, search, startTime, endTime, limit, offset } = queryResult.data;
  const db = await getDB();

  let logs: LogEntry[];

  if (serverId && startTime !== undefined && endTime !== undefined) {
    const range = IDBKeyRange.bound([serverId, startTime], [serverId, endTime]);
    logs = await db.getAllFromIndex("logs", "by-server-time", range);
  } else if (startTime !== undefined && endTime !== undefined) {
    const range = IDBKeyRange.bound(startTime, endTime);
    logs = await db.getAllFromIndex("logs", "by-timestamp", range);
  } else {
    logs = await db.getAll("logs");
  }

  // Apply filters
  if (serverId && !(startTime !== undefined && endTime !== undefined)) {
    logs = logs.filter((l) => l.serverId === serverId);
  }
  if (level) {
    logs = logs.filter((l) => l.level === level);
  }
  if (search) {
    const searchLower = search.toLowerCase();
    logs = logs.filter((l) => l.message.toLowerCase().includes(searchLower));
  }

  // Sort by timestamp descending
  logs.sort((a, b) => b.timestamp - a.timestamp);

  // Pagination
  const total = logs.length;
  const paginated = logs.slice(offset, offset + limit);

  return json({ logs: paginated, total, limit, offset });
});

const getLog = http.get("/api/logs/:id", async ({ params }) => {
  const db = await getDB();
  const log = await db.get("logs", params.id);
  if (!log) return error("Log not found", 404);
  return json(log);
});

// ─────────────────────────────────────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────────────────────────────────────

const getAlerts = http.get("/api/alerts", async () => {
  const db = await getDB();
  const alerts = await db.getAll("alerts");
  return json(alerts);
});

const getAlert = http.get("/api/alerts/:id", async ({ params }) => {
  const db = await getDB();
  const alert = await db.get("alerts", params.id);
  if (!alert) return error("Alert not found", 404);
  return json(alert);
});

const createAlert = http.post("/api/alerts", async ({ request }) => {
  const body = await request.json();
  const result = CreateAlertSchema.safeParse(body);
  if (!result.success) return error(result.error.message, 400);

  const alert = {
    id: crypto.randomUUID(),
    ...result.data,
    createdAt: Date.now(),
  };

  const validated = AlertSchema.parse(alert);
  const db = await getDB();
  await db.put("alerts", validated);
  return json(validated, { status: 201 });
});

const updateAlert = http.patch("/api/alerts/:id", async ({ params, request }) => {
  const db = await getDB();
  const existing = await db.get("alerts", params.id);
  if (!existing) return error("Alert not found", 404);

  const body = await request.json();
  const result = UpdateAlertSchema.safeParse({ ...body, id: params.id });
  if (!result.success) return error(result.error.message, 400);

  const updated = { ...existing, ...result.data };
  await db.put("alerts", updated);
  return json(updated);
});

const deleteAlert = http.delete("/api/alerts/:id", async ({ params }) => {
  const db = await getDB();
  await db.delete("alerts", params.id);
  return noContent();
});

// ─────────────────────────────────────────────────────────────────────────────
// Incidents
// ─────────────────────────────────────────────────────────────────────────────

const getIncidents = http.get("/api/incidents", async ({ request }) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  const db = await getDB();
  let incidents = await db.getAll("incidents");

  if (status) {
    incidents = incidents.filter((i) => i.status === status);
  }

  incidents.sort((a, b) => b.startedAt - a.startedAt);
  return json(incidents);
});

const acknowledgeIncident = http.post("/api/incidents/:id/acknowledge", async ({ params }) => {
  const db = await getDB();
  const incident = await db.get("incidents", params.id);
  if (!incident) return error("Incident not found", 404);

  incident.status = "acknowledged";
  await db.put("incidents", incident);
  return json(incident);
});

const resolveIncident = http.post("/api/incidents/:id/resolve", async ({ params }) => {
  const db = await getDB();
  const incident = await db.get("incidents", params.id);
  if (!incident) return error("Incident not found", 404);

  incident.status = "resolved";
  incident.resolvedAt = Date.now();
  await db.put("incidents", incident);
  return json(incident);
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Stats
// ─────────────────────────────────────────────────────────────────────────────

const getStats = http.get("/api/stats", async () => {
  const db = await getDB();
  const servers = await db.getAll("servers");
  const incidents = await db.getAllFromIndex("incidents", "by-status", "active");

  const stats: DashboardStats = {
    healthy: servers.filter((s) => s.status === "healthy").length,
    warning: servers.filter((s) => s.status === "warning").length,
    critical: servers.filter((s) => s.status === "critical").length,
    offline: servers.filter((s) => s.status === "offline").length,
    activeIncidents: incidents.length,
    totalServers: servers.length,
  };

  return json(stats);
});

// ─────────────────────────────────────────────────────────────────────────────
// Simulation Control
// ─────────────────────────────────────────────────────────────────────────────

const recordMetricTime = http.post("/api/simulation/record-time", async () => {
  await setLastMetricTime(Date.now());
  return json({ recorded: Date.now() });
});

// ─────────────────────────────────────────────────────────────────────────────
// RSC Endpoint for Server Page
// ─────────────────────────────────────────────────────────────────────────────

const getServerRSC = http.get("/rsc/server", async ({ url }) => {
  const serverId = url.searchParams.get("serverId");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  // Parse time range - support relative ranges and "now" keyword
  let startTime: number;
  let endTime: number;

  const rangeParam = url.searchParams.get("range");
  if (rangeParam) {
    // Use parseTimeRange utility
    const { parseTimeRange } = await import("@/utilities/timeRange");
    const parsed = parseTimeRange(rangeParam);
    if (parsed) {
      startTime = parsed.startTime;
      endTime = parsed.endTime;
    } else {
      // Fallback to 6 hours if parsing fails
      endTime = Date.now();
      startTime = endTime - 6 * 60 * 60 * 1000;
    }
  } else {
    // Legacy numeric params
    const endTimeParam = url.searchParams.get("endTime");
    endTime = endTimeParam === "now" ? Date.now() : Number(endTimeParam);
    startTime = Number(url.searchParams.get("startTime"));
  }

  const db = await getDB();

  // Fetch all servers
  const servers = await db.getAll("servers");

  // Determine which server to show
  let server: Server | null = null;
  if (serverId) {
    const foundServer = await db.get("servers", serverId);
    server = foundServer ?? null;
  } else if (servers.length > 0) {
    server = servers[0] ?? null;
  }

  // Fetch metrics if server is selected
  let metrics: Metric[] = [];
  if (server) {
    const range = IDBKeyRange.bound([server.id, startTime], [server.id, endTime]);
    metrics = await db.getAllFromIndex("metrics", "by-server-time", range);
    metrics.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Fetch logs if server is selected
  let logs: LogEntry[] = [];
  let logsTotal = 0;
  if (server) {
    const range = IDBKeyRange.bound([server.id, startTime], [server.id, endTime]);
    const allLogs = await db.getAllFromIndex("logs", "by-server-time", range);
    allLogs.sort((a, b) => b.timestamp - a.timestamp);

    logsTotal = allLogs.length;
    logs = allLogs.slice(offset, offset + limit);
  }

  // RSC stream API removed; use rscPrism vite plugin with worker row transport instead
  return error(
    "RSC stream transport not supported. Migrate to rscPrism vite plugin with worker row transport.",
    501,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Setup Worker
// ─────────────────────────────────────────────────────────────────────────────

setupWorker(
  [
    // RSC
    getServerRSC,
    // Servers
    getServers,
    getServer,
    createServer,
    updateServer,
    deleteServer,
    // Metrics
    getMetrics,
    getLatestMetrics,
    // Logs
    getLogs,
    getLog,
    // Alerts
    getAlerts,
    getAlert,
    createAlert,
    updateAlert,
    deleteAlert,
    // Incidents
    getIncidents,
    acknowledgeIncident,
    resolveIncident,
    // Stats
    getStats,
    // Simulation
    recordMetricTime,
  ],
  {
    basePath: self.location.pathname.replace(/\/sw\.js$/, ""),
  },
);
