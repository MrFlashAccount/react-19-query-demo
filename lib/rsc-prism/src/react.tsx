import { startTransition, use, useEffect, useState } from "react";
import { bootstrapWorkerRuntime, fetchRSC } from "./client";
import type { ComponentReference } from "./types";
import { setInvalidateRSC } from "./runtime-globals";

const $$invalidations = new Set<() => void>();
export function invalidateRSC() {
  for (const invalidation of $$invalidations) {
    try {
      invalidation();
    } catch (error) {
      console.error("Error invalidating RSC", error);
    }
  }
}

setInvalidateRSC(invalidateRSC);

export type RSCLoaderProps<Props = unknown> = Props & {
  /**
   * A key that will be used to invalidate the RSC component.
   */
  $refreshKey?: unknown;
};

interface LoaderCacheEntry {
  key: string;
  promise: Promise<React.ReactNode>;
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

interface ValueTokenContext {
  seen: WeakMap<object, number>;
  nextSeenId: number;
}

function serializeValueToken(value: unknown, context: ValueTokenContext): unknown {
  if (value == null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (Number.isNaN(value)) return { $type: "number", value: "NaN" };
    if (!Number.isFinite(value)) return { $type: "number", value: String(value) };
    if (Object.is(value, -0)) return { $type: "number", value: "-0" };
    return value;
  }

  if (typeof value === "bigint") {
    return { $type: "bigint", value: String(value) };
  }

  if (typeof value === "undefined") {
    return { $type: "undefined" };
  }

  if (typeof value === "symbol") {
    return { $type: "symbol", value: String(value.description ?? "") };
  }

  if (typeof value === "function") {
    return { $type: "function", value: value.name || "anonymous" };
  }

  if (typeof value !== "object") {
    return { $type: "unknown" };
  }

  const seenRef = context.seen.get(value);
  if (seenRef != null) {
    return { $type: "ref", value: seenRef };
  }

  const seenId = context.nextSeenId;
  context.nextSeenId += 1;
  context.seen.set(value, seenId);

  if (Array.isArray(value)) {
    return value.map((item) => serializeValueToken(item, context));
  }

  if (value instanceof Date) {
    return { $type: "date", value: value.toISOString() };
  }

  if (value instanceof URLSearchParams) {
    const params = Array.from(value.entries()).sort(
      ([leftKey, leftValue], [rightKey, rightValue]) => {
        const keyOrder = leftKey.localeCompare(rightKey);
        if (keyOrder !== 0) return keyOrder;
        return leftValue.localeCompare(rightValue);
      },
    );
    return { $type: "urlsearchparams", value: params };
  }

  if (value instanceof Set) {
    const items = Array.from(value, (item) => serializeValueToken(item, context)).sort(
      (left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
    return { $type: "set", value: items };
  }

  if (value instanceof Map) {
    const entries = Array.from(
      value,
      ([key, item]) =>
        [serializeValueToken(key, context), serializeValueToken(item, context)] as const,
    ).sort(([leftKey], [rightKey]) =>
      JSON.stringify(leftKey).localeCompare(JSON.stringify(rightKey)),
    );
    return { $type: "map", value: entries };
  }

  if (isPlainObject(value)) {
    const sortedEntries = Object.entries(value)
      .filter(([key]) => key !== "$refreshKey")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, serializeValueToken(item, context)] as const);
    return Object.fromEntries(sortedEntries);
  }

  const objectEntries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, serializeValueToken(item, context)] as const);
  return {
    $type: "object",
    constructor: value.constructor?.name ?? "Object",
    value: Object.fromEntries(objectEntries),
  };
}

function createValueToken(value: unknown, context?: ValueTokenContext): string {
  const resolvedContext: ValueTokenContext = context ?? {
    seen: new WeakMap<object, number>(),
    nextSeenId: 1,
  };
  return JSON.stringify(serializeValueToken(value, resolvedContext));
}

function createPropsToken(props: unknown): string {
  return `props:${createValueToken(props)}`;
}

export function rsc<Props = unknown>(reference: ComponentReference<Props>) {
  const cache = new Map<string, LoaderCacheEntry>();

  return function RSCLoader(props: RSCLoaderProps<Props>) {
    const [, $$refresh] = useState({});
    const key = createPropsToken(props);

    useEffect(() => {
      const invalidate = () => {
        startTransition(() => {
          cache.clear();
          $$refresh({});
        });
      };
      $$invalidations.add(invalidate);
      return () => {
        $$invalidations.delete(invalidate);
      };
    }, []);

    const cached = cache.get(key);
    if (cached != null) {
      return cached.promise;
    }

    const promise = fetchRSC(reference, { props });
    const entry = { key, promise } as const;
    cache.set(key, entry);

    return promise;
  };
}

const runtimePromise = bootstrapWorkerRuntime();

export function RuntimeProvider({ children }: React.PropsWithChildren) {
  use(runtimePromise);
  return children;
}
