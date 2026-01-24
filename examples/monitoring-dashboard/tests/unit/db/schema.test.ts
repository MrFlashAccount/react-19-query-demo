import { describe, it, expect } from "vitest";
import {
  ServerSchema,
  MetricSchema,
  LogEntrySchema,
  AlertSchema,
  CreateServerSchema,
} from "@db/schema";

describe("ServerSchema", () => {
  it("should validate a valid server", () => {
    const server = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "web-us-001",
      ip: "10.0.1.50",
      region: "us-east",
      status: "healthy",
      tags: ["web", "production"],
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };

    const result = ServerSchema.safeParse(server);
    expect(result.success).toBe(true);
  });

  it("should reject invalid IP", () => {
    const server = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "test",
      ip: "not-an-ip",
      region: "us-east",
      status: "healthy",
      tags: [],
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };

    const result = ServerSchema.safeParse(server);
    expect(result.success).toBe(false);
  });

  it("should reject invalid region", () => {
    const server = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "test",
      ip: "10.0.0.1",
      region: "invalid-region",
      status: "healthy",
      tags: [],
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };

    const result = ServerSchema.safeParse(server);
    expect(result.success).toBe(false);
  });
});

describe("MetricSchema", () => {
  it("should validate valid metrics", () => {
    const metric = {
      id: "server-123-1234567890",
      serverId: "550e8400-e29b-41d4-a716-446655440000",
      timestamp: Date.now(),
      cpu: 45.5,
      memory: 72.3,
      networkIn: 1234.56,
      networkOut: 789.12,
      diskRead: 100.0,
      diskWrite: 50.0,
    };

    const result = MetricSchema.safeParse(metric);
    expect(result.success).toBe(true);
  });

  it("should reject cpu over 100", () => {
    const metric = {
      id: "test",
      serverId: "550e8400-e29b-41d4-a716-446655440000",
      timestamp: Date.now(),
      cpu: 150,
      memory: 50,
      networkIn: 100,
      networkOut: 100,
      diskRead: 0,
      diskWrite: 0,
    };

    const result = MetricSchema.safeParse(metric);
    expect(result.success).toBe(false);
  });
});

describe("LogEntrySchema", () => {
  it("should validate valid log entry", () => {
    const log = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      serverId: "550e8400-e29b-41d4-a716-446655440001",
      timestamp: Date.now(),
      level: "info",
      message: "Server started",
      service: "nginx",
      metadata: { requestId: "abc123" },
    };

    const result = LogEntrySchema.safeParse(log);
    expect(result.success).toBe(true);
  });

  it("should accept log without metadata", () => {
    const log = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      serverId: "550e8400-e29b-41d4-a716-446655440001",
      timestamp: Date.now(),
      level: "debug",
      message: "Test",
    };

    const result = LogEntrySchema.safeParse(log);
    expect(result.success).toBe(true);
  });
});

describe("AlertSchema", () => {
  it("should validate valid alert", () => {
    const alert = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "High CPU",
      serverId: null,
      metric: "cpu",
      operator: ">",
      threshold: 80,
      duration: 300,
      enabled: true,
      createdAt: Date.now(),
    };

    const result = AlertSchema.safeParse(alert);
    expect(result.success).toBe(true);
  });

  it("should reject invalid operator", () => {
    const alert = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test",
      serverId: null,
      metric: "cpu",
      operator: "==",
      threshold: 80,
      duration: 300,
      enabled: true,
      createdAt: Date.now(),
    };

    const result = AlertSchema.safeParse(alert);
    expect(result.success).toBe(false);
  });
});

describe("CreateServerSchema", () => {
  it("should validate create server payload", () => {
    const payload = {
      name: "new-server",
      ip: "10.0.0.1",
      region: "eu-west",
      status: "healthy",
      tags: ["new"],
    };

    const result = CreateServerSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
