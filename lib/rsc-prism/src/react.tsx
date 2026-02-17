import { useEffect, useState, useTransition } from "react";
import { fetchRSC } from "./client";
import type { ComponentReference } from "./types";
import console from "console";

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

const valueIdentityMap = new WeakMap<object, number>();
let valueIdentityCounter = 0;

function getValueIdentity(value: object): number {
  const existing = valueIdentityMap.get(value);
  if (existing != null) {
    return existing;
  }
  valueIdentityCounter += 1;
  valueIdentityMap.set(value, valueIdentityCounter);
  return valueIdentityCounter;
}

function createPrimitiveToken(value: unknown): string {
  if (value == null) return "null";

  switch (typeof value) {
    case "string":
      return `s:${value}`;
    case "number":
      return `n:${value}`;
    case "boolean":
      return `b:${value ? "1" : "0"}`;
    case "bigint":
      return `bi:${value}`;
    case "symbol":
      return `sym:${String(value.description ?? "")}`;
    case "undefined":
      return "u";
    default:
      return "";
  }
}

interface ValueTokenContext {
  seen: WeakMap<object, number>;
  nextSeenId: number;
}

function createValueToken(value: unknown, context?: ValueTokenContext): string {
  const resolvedContext: ValueTokenContext = context ?? {
    seen: new WeakMap<object, number>(),
    nextSeenId: 1,
  };
  const primitiveToken = createPrimitiveToken(value);
  if (primitiveToken !== "") {
    return primitiveToken;
  }

  if (typeof value === "function") {
    return `fn:${getValueIdentity(value)}`;
  }

  if (typeof value !== "object" || value == null) {
    return `x:${String(value)}`;
  }

  const seenRef = resolvedContext.seen.get(value);
  if (seenRef != null) {
    return `ref:${seenRef}`;
  }

  const seenId = resolvedContext.nextSeenId;
  resolvedContext.nextSeenId += 1;
  resolvedContext.seen.set(value, seenId);

  if (Array.isArray(value)) {
    const items = value.map((item) => createValueToken(item, resolvedContext));
    return `arr:[${items.join(",")}]`;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .filter(([key]) => key !== "$refreshKey")
      .sort(([left], [right]) => left.localeCompare(right));
    const parts = entries.map(([key, item]) => `${key}:${createValueToken(item, resolvedContext)}`);
    return `obj:{${parts.join(",")}}`;
  }

  if (value instanceof Date) {
    return `date:${value.toISOString()}`;
  }

  if (value instanceof URLSearchParams) {
    return `urlsearch:${value.toString()}`;
  }

  return `o:${getValueIdentity(value)}`;
}

function createPropsToken(props: unknown): string {
  return `props:${createValueToken(props)}`;
}

function createLoaderKey(props: unknown): string {
  if (typeof props === "object" && props != null && "$refreshKey" in props) {
    const refreshKey = (props as { $refreshKey?: unknown }).$refreshKey;
    if (refreshKey !== undefined) {
      return `refresh:${createValueToken(refreshKey)}`;
    }
  }

  return createPropsToken(props);
}

export function rsc<Props = unknown>(reference: ComponentReference<Props>) {
  const cache = new Map<string, LoaderCacheEntry>();

  return function RSCLoader(props: RSCLoaderProps<Props>) {
    const [, startTransition] = useTransition();
    const [, $$refresh] = useState({});

    const key = createLoaderKey(props);

    useEffect(() => {
      const invalidate = () => {
        cache.clear();
        startTransition(() => {
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

    void promise.catch(() => {
      const current = cache.get(key);
      if (current === entry) {
        cache.delete(key);
      }
    });

    return promise;
  };
}
