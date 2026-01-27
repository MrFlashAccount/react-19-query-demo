import { query, mutation, DependencyGraph } from "@lib/goat-query";
import type {
  Server,
  Metric,
  LogEntry,
  Alert,
  Incident,
  DashboardStats,
  CreateServer,
  UpdateServer,
  CreateAlert,
  UpdateAlert,
  LogQuery,
} from "@/db/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Stats (defined first as it's used by mutations)
// ─────────────────────────────────────────────────────────────────────────────

export const statsQuery = query<void, DashboardStats>({
  queryFn: async () => {
    const res = await fetch("/api/stats");
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  },
  staleTime: 2000,
  gcTime: 10_000,
});

// ─────────────────────────────────────────────────────────────────────────────
// Servers
// ─────────────────────────────────────────────────────────────────────────────

export const serversQuery = query<void, Server[]>({
  queryFn: async () => {
    const res = await fetch("/api/servers");
    if (!res.ok) throw new Error("Failed to fetch servers");
    return res.json();
  },
  staleTime: 5000,
  gcTime: 60_000,
});

export const serverQuery = query<string, Server>({
  queryFn: async (id) => {
    const res = await fetch(`/api/servers/${id}`);
    if (!res.ok) throw new Error("Failed to fetch server");
    return res.json();
  },
  staleTime: 5000,
});

export const createServerMutation = mutation({
  mutationFn: async (data: CreateServer): Promise<Server> => {
    const res = await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create server");
    return res.json();
  },
  invalidates: [serversQuery, statsQuery],
});

export const updateServerMutation = mutation({
  mutationFn: async ({ id, ...data }: UpdateServer): Promise<Server> => {
    const res = await fetch(`/api/servers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update server");
    return res.json();
  },
  invalidates: [serversQuery, statsQuery],
});

export const deleteServerMutation = mutation({
  mutationFn: async (id: string): Promise<void> => {
    const res = await fetch(`/api/servers/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete server");
  },
  invalidates: [serversQuery, statsQuery],
});

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────

interface MetricQueryParams {
  serverIds: string[];
  startTime: number;
  endTime: number;
}

export const metricsQuery = query<MetricQueryParams, Metric[]>({
  queryFn: async (params) => {
    const res = await fetch("/api/metrics/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error("Failed to fetch metrics");
    return res.json();
  },
});

export const latestMetricsQuery = query<string[], Record<string, Metric | null>>({
  queryFn: async (serverIds) => {
    const res = await fetch(`/api/metrics/latest?serverIds=${serverIds.join(",")}`);
    if (!res.ok) throw new Error("Failed to fetch latest metrics");
    return res.json();
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Logs
// ─────────────────────────────────────────────────────────────────────────────

export interface LogsResponse {
  logs: LogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export const logsQuery = query<Partial<LogQuery>, LogsResponse>({
  queryFn: async (params) => {
    const searchParams = new URLSearchParams();
    if (params.serverId) searchParams.set("serverId", params.serverId);
    if (params.level) searchParams.set("level", params.level);
    if (params.search) searchParams.set("search", params.search);
    if (params.startTime) searchParams.set("startTime", String(params.startTime));
    if (params.endTime) searchParams.set("endTime", String(params.endTime));
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.offset) searchParams.set("offset", String(params.offset));

    const res = await fetch(`/api/logs?${searchParams}`);
    if (!res.ok) throw new Error("Failed to fetch logs");
    return res.json();
  },
});

export const logQuery = query<string, LogEntry>({
  queryFn: async (id) => {
    const res = await fetch(`/api/logs/${id}`);
    if (!res.ok) throw new Error("Failed to fetch log");
    return res.json();
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────────────────────────────────────

export const alertsQuery = query<void, Alert[]>({
  queryFn: async () => {
    const res = await fetch("/api/alerts");
    if (!res.ok) throw new Error("Failed to fetch alerts");
    return res.json();
  },
});

export const alertQuery = query<string, Alert>({
  queryFn: async (id) => {
    const res = await fetch(`/api/alerts/${id}`);
    if (!res.ok) throw new Error("Failed to fetch alert");
    return res.json();
  },
});

export const createAlertMutation = mutation({
  mutationFn: async (data: CreateAlert): Promise<Alert> => {
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create alert");
    return res.json();
  },
  invalidates: [alertsQuery],
});

export const updateAlertMutation = mutation({
  mutationFn: async ({ id, ...data }: UpdateAlert): Promise<Alert> => {
    const res = await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update alert");
    return res.json();
  },
  invalidates: [alertsQuery],
});

export const deleteAlertMutation = mutation({
  mutationFn: async (id: string): Promise<void> => {
    const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete alert");
  },
  invalidates: [alertsQuery],
});

// ─────────────────────────────────────────────────────────────────────────────
// Incidents
// ─────────────────────────────────────────────────────────────────────────────

export const incidentsQuery = query<string | undefined, Incident[]>({
  queryFn: async (status) => {
    const url = status ? `/api/incidents?status=${status}` : "/api/incidents";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch incidents");
    return res.json();
  },
});

export const acknowledgeIncidentMutation = mutation({
  mutationFn: async (id: string): Promise<Incident> => {
    const res = await fetch(`/api/incidents/${id}/acknowledge`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to acknowledge incident");
    return res.json();
  },
  invalidates: [incidentsQuery, statsQuery],
});

export const resolveIncidentMutation = mutation({
  mutationFn: async (id: string): Promise<Incident> => {
    const res = await fetch(`/api/incidents/${id}/resolve`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to resolve incident");
    return res.json();
  },
  invalidates: [incidentsQuery, statsQuery],
});

export const graph = new DependencyGraph([
  serversQuery,
  serverQuery,
  statsQuery,
  createServerMutation,
  updateServerMutation,
  deleteServerMutation,
  metricsQuery,
  latestMetricsQuery,
  logsQuery,
  logQuery,
  alertsQuery,
  alertQuery,
  incidentsQuery,
  acknowledgeIncidentMutation,
  resolveIncidentMutation,
]);
