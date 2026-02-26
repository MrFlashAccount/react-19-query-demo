import { describe, expect, it } from "vitest";
import type React from "react";

import { createFromRowEmitter } from "../src/flight-runtime/client";
import { renderToRowEmitter } from "../src/flight-runtime/server";
import {
  decodeWireValue,
  encodeWireValue,
  flightDoneRow,
  flightModelRow,
} from "../src/flight-runtime/wire";

function createClientRefResolver(): (id: string) => unknown {
  return (_id: string): unknown => null;
}

describe("structured clone row transport", () => {
  function roundTrip<T>(value: T): Promise<T> {
    const encoded = encodeWireValue(value);
    const emitter = createFromRowEmitter<T>();
    emitter.push(flightModelRow(0, encoded));
    emitter.push(flightDoneRow());
    return emitter.result;
  }

  it("round-trips plain objects, arrays, primitives", async () => {
    expect(await roundTrip("ok")).toBe("ok");
    expect(await roundTrip(42)).toBe(42);
    expect(await roundTrip(true)).toBe(true);
    expect(await roundTrip(null)).toBe(null);
    expect(await roundTrip([1, 2, 3])).toEqual([1, 2, 3]);
    expect(await roundTrip({ a: 1, b: "x" })).toEqual({ a: 1, b: "x" });
  });

  it("preserves -0 (lost by JSON)", async () => {
    const result = await roundTrip(-0);
    expect(result).toBe(-0);
    expect(Object.is(result, -0)).toBe(true);
  });

  it("preserves NaN (lost by JSON)", async () => {
    const result = await roundTrip(NaN);
    expect(Number.isNaN(result)).toBe(true);
  });

  it("preserves Infinity", async () => {
    expect(await roundTrip(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
    expect(await roundTrip(Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY);
  });

  it("round-trips Date via wire format (decodeWireValue)", async () => {
    const d = new Date("2025-01-15T12:00:00.000Z");
    const encoded = encodeWireValue(d);
    const result = decodeWireValue(encoded, createClientRefResolver()) as Date;
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe("2025-01-15T12:00:00.000Z");
  });

  it("round-trips Map via wire format (decodeWireValue)", async () => {
    const m = new Map<string, unknown>([
      ["a", 1],
      ["b", { nested: true }],
    ]);
    const encoded = encodeWireValue(m);
    const result = decodeWireValue(encoded, createClientRefResolver()) as Map<string, unknown>;
    expect(result).toBeInstanceOf(Map);
    expect(result.get("a")).toBe(1);
    expect(result.get("b")).toEqual({ nested: true });
  });

  it("round-trips Set via wire format (decodeWireValue)", async () => {
    const s = new Set(["x", "y", 1]);
    const encoded = encodeWireValue(s);
    const result = decodeWireValue(encoded, createClientRefResolver()) as Set<unknown>;
    expect(result).toBeInstanceOf(Set);
    expect(result.has("x")).toBe(true);
    expect(result.has("y")).toBe(true);
    expect(result.has(1)).toBe(true);
  });

  it("round-trips bigint via wire format (decodeWireValue)", async () => {
    const encoded = encodeWireValue(123n);
    const result = decodeWireValue(encoded, createClientRefResolver()) as bigint;
    expect(result).toBe(123n);
  });

  describe("renderToRowEmitter sends raw values", () => {
    it("Date comes through as native Date", async () => {
      const d = new Date("2025-01-15T12:00:00.000Z");
      const rows: Array<{ k: number; id: number; v: unknown } | { k: number }> = [];
      await renderToRowEmitter(
        d as unknown as React.ReactNode,
        null,
        (row: { k: number; id?: number; v?: unknown }) => {
          if (row.k === 0 && "v" in row) rows.push(row as { k: number; id: number; v: unknown });
          else if (row.k === 2) rows.push(row as { k: number });
        },
      );
      const modelRow = rows.find((r) => "v" in r && r.id === 0) as { v: unknown };
      expect(modelRow.v).toBeInstanceOf(Date);
      expect((modelRow.v as Date).toISOString()).toBe("2025-01-15T12:00:00.000Z");
    });

    it("Map comes through as native Map", async () => {
      const m = new Map<string, unknown>([
        ["a", 1],
        ["b", "x"],
      ]);
      const rows: Array<{ k: number; id: number; v: unknown } | { k: number }> = [];
      await renderToRowEmitter(
        m as unknown as React.ReactNode,
        null,
        (row: { k: number; id?: number; v?: unknown }) => {
          if (row.k === 0 && "v" in row) rows.push(row as { k: number; id: number; v: unknown });
          else if (row.k === 2) rows.push(row as { k: number });
        },
      );
      const modelRow = rows.find((r) => "v" in r && r.id === 0) as { v: unknown };
      expect(modelRow.v).toBeInstanceOf(Map);
      expect((modelRow.v as Map<string, unknown>).get("a")).toBe(1);
      expect((modelRow.v as Map<string, unknown>).get("b")).toBe("x");
    });

    it("Set comes through as native Set", async () => {
      const s = new Set(["x", 1]);
      const rows: Array<{ k: number; id: number; v: unknown } | { k: number }> = [];
      await renderToRowEmitter(
        s as unknown as React.ReactNode,
        null,
        (row: { k: number; id?: number; v?: unknown }) => {
          if (row.k === 0 && "v" in row) rows.push(row as { k: number; id: number; v: unknown });
          else if (row.k === 2) rows.push(row as { k: number });
        },
      );
      const modelRow = rows.find((r) => "v" in r && r.id === 0) as { v: unknown };
      expect(modelRow.v).toBeInstanceOf(Set);
      expect((modelRow.v as Set<unknown>).has("x")).toBe(true);
      expect((modelRow.v as Set<unknown>).has(1)).toBe(true);
    });

    it("bigint comes through as native bigint", async () => {
      const rows: Array<{ k: number; id: number; v: unknown } | { k: number }> = [];
      await renderToRowEmitter(
        123n as unknown as React.ReactNode,
        null,
        (row: { k: number; id?: number; v?: unknown }) => {
          if (row.k === 0 && "v" in row) rows.push(row as { k: number; id: number; v: unknown });
          else if (row.k === 2) rows.push(row as { k: number });
        },
      );
      const modelRow = rows.find((r) => "v" in r && r.id === 0) as { v: unknown };
      expect(modelRow.v).toBe(123n);
    });
  });
});
