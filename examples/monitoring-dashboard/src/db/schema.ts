import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────────────────────

export const RegionSchema = z.enum(["us-east", "us-west", "eu-west", "eu-central", "asia-pacific"]);
export type Region = z.infer<typeof RegionSchema>;

export const ServerStatusSchema = z.enum(["healthy", "warning", "critical", "offline"]);
export type ServerStatus = z.infer<typeof ServerStatusSchema>;

export const ServerSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100),
  ip: z.ipv4(),
  region: RegionSchema,
  status: ServerStatusSchema,
  tags: z.array(z.string()),
  createdAt: z.number(),
  lastSeen: z.number(),
});
export type Server = z.infer<typeof ServerSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const MetricSchema = z.object({
  id: z.string(),
  serverId: z.string().uuid(),
  timestamp: z.number(),
  cpu: z.number().min(0).max(100),
  memory: z.number().min(0).max(100),
  networkIn: z.number().nonnegative(),
  networkOut: z.number().nonnegative(),
  diskRead: z.number().nonnegative(),
  diskWrite: z.number().nonnegative(),
});
export type Metric = z.infer<typeof MetricSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Logs
// ─────────────────────────────────────────────────────────────────────────────

export const LogLevelSchema = z.enum(["debug", "info", "warn", "error", "critical"]);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const LogEntrySchema = z.object({
  id: z.string().uuid(),
  serverId: z.string().uuid(),
  timestamp: z.number(),
  level: LogLevelSchema,
  message: z.string(),
  service: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────────────────────────────────────

export const AlertMetricSchema = z.enum(["cpu", "memory", "networkIn", "networkOut"]);
export type AlertMetric = z.infer<typeof AlertMetricSchema>;

export const AlertOperatorSchema = z.enum([">", "<", ">=", "<="]);
export type AlertOperator = z.infer<typeof AlertOperatorSchema>;

export const AlertSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  serverId: z.string().uuid().nullable(), // null = all servers
  metric: AlertMetricSchema,
  operator: AlertOperatorSchema,
  threshold: z.number(),
  duration: z.number().positive(), // seconds
  enabled: z.boolean(),
  createdAt: z.number(),
});
export type Alert = z.infer<typeof AlertSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Incidents
// ─────────────────────────────────────────────────────────────────────────────

export const IncidentStatusSchema = z.enum(["active", "acknowledged", "resolved"]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const IncidentSchema = z.object({
  id: z.string().uuid(),
  alertId: z.string().uuid(),
  serverId: z.string().uuid(),
  status: IncidentStatusSchema,
  value: z.number(),
  startedAt: z.number(),
  resolvedAt: z.number().nullable(),
});
export type Incident = z.infer<typeof IncidentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Preferences
// ─────────────────────────────────────────────────────────────────────────────

export const PreferenceSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});
export type Preference = z.infer<typeof PreferenceSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// API Request/Response Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const CreateServerSchema = ServerSchema.omit({ id: true, createdAt: true, lastSeen: true });
export type CreateServer = z.infer<typeof CreateServerSchema>;

export const UpdateServerSchema = ServerSchema.partial().required({ id: true });
export type UpdateServer = z.infer<typeof UpdateServerSchema>;

export const CreateAlertSchema = AlertSchema.omit({ id: true, createdAt: true });
export type CreateAlert = z.infer<typeof CreateAlertSchema>;

export const UpdateAlertSchema = AlertSchema.partial().required({ id: true });
export type UpdateAlert = z.infer<typeof UpdateAlertSchema>;

export const LogQuerySchema = z.object({
  serverId: z.string().uuid().optional(),
  level: LogLevelSchema.optional(),
  search: z.string().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
});
export type LogQuery = z.infer<typeof LogQuerySchema>;

export const MetricQuerySchema = z.object({
  serverIds: z.array(z.string().uuid()),
  startTime: z.number(),
  endTime: z.number(),
  resolution: z.enum(["1m", "5m", "15m", "1h"]).default("1m"),
});
export type MetricQuery = z.infer<typeof MetricQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Stats
// ─────────────────────────────────────────────────────────────────────────────

export const DashboardStatsSchema = z.object({
  healthy: z.number(),
  warning: z.number(),
  critical: z.number(),
  offline: z.number(),
  activeIncidents: z.number(),
  totalServers: z.number(),
});
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
