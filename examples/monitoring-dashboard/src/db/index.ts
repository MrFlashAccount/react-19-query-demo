import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type { Server, Metric, LogEntry, Alert, Incident, Preference } from "./schema";

// ─────────────────────────────────────────────────────────────────────────────
// Database Schema
// ─────────────────────────────────────────────────────────────────────────────

export interface MonitoringDB extends DBSchema {
  servers: {
    key: string;
    value: Server;
    indexes: {
      "by-region": string;
      "by-status": string;
    };
  };
  metrics: {
    key: string;
    value: Metric;
    indexes: {
      "by-server-time": [string, number];
      "by-timestamp": number;
    };
  };
  logs: {
    key: string;
    value: LogEntry;
    indexes: {
      "by-timestamp": number;
      "by-server-time": [string, number];
      "by-level": string;
    };
  };
  alerts: {
    key: string;
    value: Alert;
    indexes: {
      "by-server": string;
    };
  };
  incidents: {
    key: string;
    value: Incident;
    indexes: {
      "by-alert-time": [string, number];
      "by-status": string;
    };
  };
  preferences: {
    key: string;
    value: Preference;
  };
}

const DB_NAME = "monitoring-dashboard";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MonitoringDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<MonitoringDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MonitoringDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Servers store
        if (!db.objectStoreNames.contains("servers")) {
          const serverStore = db.createObjectStore("servers", { keyPath: "id" });
          serverStore.createIndex("by-region", "region");
          serverStore.createIndex("by-status", "status");
        }

        // Metrics store
        if (!db.objectStoreNames.contains("metrics")) {
          const metricsStore = db.createObjectStore("metrics", { keyPath: "id" });
          metricsStore.createIndex("by-server-time", ["serverId", "timestamp"]);
          metricsStore.createIndex("by-timestamp", "timestamp");
        }

        // Logs store
        if (!db.objectStoreNames.contains("logs")) {
          const logsStore = db.createObjectStore("logs", { keyPath: "id" });
          logsStore.createIndex("by-timestamp", "timestamp");
          logsStore.createIndex("by-server-time", ["serverId", "timestamp"]);
          logsStore.createIndex("by-level", "level");
        }

        // Alerts store
        if (!db.objectStoreNames.contains("alerts")) {
          const alertsStore = db.createObjectStore("alerts", { keyPath: "id" });
          alertsStore.createIndex("by-server", "serverId");
        }

        // Incidents store
        if (!db.objectStoreNames.contains("incidents")) {
          const incidentsStore = db.createObjectStore("incidents", { keyPath: "id" });
          incidentsStore.createIndex("by-alert-time", ["alertId", "startedAt"]);
          incidentsStore.createIndex("by-status", "status");
        }

        // Preferences store
        if (!db.objectStoreNames.contains("preferences")) {
          db.createObjectStore("preferences", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ["servers", "metrics", "logs", "alerts", "incidents", "preferences"],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("servers").clear(),
    tx.objectStore("metrics").clear(),
    tx.objectStore("logs").clear(),
    tx.objectStore("alerts").clear(),
    tx.objectStore("incidents").clear(),
    tx.objectStore("preferences").clear(),
    tx.done,
  ]);
}

export async function isSeeded(): Promise<boolean> {
  const db = await getDB();
  const pref = await db.get("preferences", "seeded");
  return pref?.value === true;
}

export async function markSeeded(): Promise<void> {
  const db = await getDB();
  await db.put("preferences", { key: "seeded", value: true });
}

export async function getLastMetricTime(): Promise<number | null> {
  const db = await getDB();
  const pref = await db.get("preferences", "lastMetricTime");
  return typeof pref?.value === "number" ? pref.value : null;
}

export async function setLastMetricTime(time: number): Promise<void> {
  const db = await getDB();
  await db.put("preferences", { key: "lastMetricTime", value: time });
}

