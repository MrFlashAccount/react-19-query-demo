import { query, mutation, DependencyGraph } from "@lib/goat-query";
import { fetchRSC } from "@lib/rsc-prism/client-only";
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

const basePath = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL.slice(0, -1)
  : import.meta.env.BASE_URL;

function withBase(path: string): string {
  return `${basePath}${path}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Stats (defined first as it's used by mutations)
// ─────────────────────────────────────────────────────────────────────────────

export const statsQuery = query<void, DashboardStats>({
  queryFn: async () => {
    const res = await fetch(withBase("/api/stats"));
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  },
  staleTime: 2000,
  gcTime: 10_000,
});

// ─────────────────────────────────────────────────────────────────────────────
// RSC Server Page
// ─────────────────────────────────────────────────────────────────────────────

interface ServerRSCParams {
  serverId: string | null;
  range: string;
  limit: number;
  offset: number;
}

export const serverRSCQuery = query<ServerRSCParams, React.ReactNode>({
  queryFn: async ({ serverId, range, limit = 300, offset }) => {
    const params = new URLSearchParams({
      range,
      limit: String(limit),
      offset: String(offset),
    });
    if (serverId) {
      params.set("serverId", serverId);
    }

    const rscUrl = withBase(`/rsc/server?${params}`);
    return (await fetchRSC(rscUrl)) as React.ReactNode;
  },
  staleTime: 1000,
  gcTime: 5_000,
});

// ─────────────────────────────────────────────────────────────────────────────
// Servers
// ─────────────────────────────────────────────────────────────────────────────

export const serversQuery = query<void, Server[]>({
  queryFn: async () => {
    const res = await fetch(withBase("/api/servers"));
    if (!res.ok) throw new Error("Failed to fetch servers");
    return res.json();
  },
  staleTime: 5000,
  gcTime: 60_000,
});

export const serverQuery = query<string, Server>({
  queryFn: async (id) => {
    const res = await fetch(withBase(`/api/servers/${id}`));
    if (!res.ok) throw new Error("Failed to fetch server");
    return res.json();
  },
  staleTime: 5000,
});

export const createServerMutation = mutation({
  mutationFn: async (data: CreateServer): Promise<Server> => {
    const res = await fetch(withBase("/api/servers"), {
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
    const res = await fetch(withBase(`/api/servers/${id}`), {
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
    const res = await fetch(withBase(`/api/servers/${id}`), { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete server");
  },
  invalidates: [serversQuery, statsQuery],
});

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────

interface MetricQueryParams {
  serverIds: string[];
  range: string;
}

export const metricsQuery = query<MetricQueryParams, Metric[]>({
  queryFn: async (params) => {
    const res = await fetch(withBase("/api/metrics/query"), {
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
    const res = await fetch(withBase(`/api/metrics/latest?serverIds=${serverIds.join(",")}`));
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

export interface LogQueryWithRange extends Omit<Partial<LogQuery>, "startTime" | "endTime"> {
  range?: string;
}

export const logsQuery = query<LogQueryWithRange, LogsResponse>({
  queryFn: async (params) => {
    const searchParams = new URLSearchParams();
    if (params.serverId) searchParams.set("serverId", params.serverId);
    if (params.level) searchParams.set("level", params.level);
    if (params.search) searchParams.set("search", params.search);
    if (params.range) searchParams.set("range", params.range);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.offset) searchParams.set("offset", String(params.offset));

    const res = await fetch(withBase(`/api/logs?${searchParams}`));
    if (!res.ok) throw new Error("Failed to fetch logs");
    return res.json();
  },
});

export const logQuery = query<string, LogEntry>({
  queryFn: async (id) => {
    const res = await fetch(withBase(`/api/logs/${id}`));
    if (!res.ok) throw new Error("Failed to fetch log");
    return res.json();
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────────────────────────────────────

export const alertsQuery = query<void, Alert[]>({
  queryFn: async () => {
    const res = await fetch(withBase("/api/alerts"));
    if (!res.ok) throw new Error("Failed to fetch alerts");
    return res.json();
  },
});

export const alertQuery = query<string, Alert>({
  queryFn: async (id) => {
    const res = await fetch(withBase(`/api/alerts/${id}`));
    if (!res.ok) throw new Error("Failed to fetch alert");
    return res.json();
  },
});

export const createAlertMutation = mutation({
  mutationFn: async (data: CreateAlert): Promise<Alert> => {
    const res = await fetch(withBase("/api/alerts"), {
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
    const res = await fetch(withBase(`/api/alerts/${id}`), {
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
    const res = await fetch(withBase(`/api/alerts/${id}`), { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete alert");
  },
  invalidates: [alertsQuery],
});

export const toggleAlertMutation = mutation({
  mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }): Promise<Alert> => {
    const res = await fetch(withBase(`/api/alerts/${id}/toggle`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error("Failed to toggle alert");
    return res.json();
  },
  invalidates: [alertsQuery],
});

// ─────────────────────────────────────────────────────────────────────────────
// Incidents
// ─────────────────────────────────────────────────────────────────────────────

export const incidentsQuery = query<string | undefined, Incident[]>({
  queryFn: async (status) => {
    const url = status ? withBase(`/api/incidents?status=${status}`) : withBase("/api/incidents");
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch incidents");
    return res.json();
  },
});

export const acknowledgeIncidentMutation = mutation({
  mutationFn: async (id: string): Promise<Incident> => {
    const res = await fetch(withBase(`/api/incidents/${id}/acknowledge`), { method: "POST" });
    if (!res.ok) throw new Error("Failed to acknowledge incident");
    return res.json();
  },
  invalidates: [incidentsQuery, statsQuery],
});

export const resolveIncidentMutation = mutation({
  mutationFn: async (id: string): Promise<Incident> => {
    const res = await fetch(withBase(`/api/incidents/${id}/resolve`), { method: "POST" });
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
  createAlertMutation,
  updateAlertMutation,
  deleteAlertMutation,
  toggleAlertMutation,
  incidentsQuery,
  acknowledgeIncidentMutation,
  resolveIncidentMutation,
]);
