import { startTransition, use, useEffect, useRef, useState } from "react";
import { bootstrapWorkerRuntime, createCallServer, fetchRSC } from "./client";
import { createFromRowEmitter } from "./flight-runtime/client";
import type { FlightRowMessage } from "./flight-runtime/wire";
import type { ComponentReference } from "./types";
import {
  DEFAULT_WORKER_RUNTIME_GLOBAL_KEY,
  setInvalidateRSC,
  setRSCRefreshRuntime,
  type RSCRefreshBatch,
} from "./runtime-globals";
import { createTraceRequestId } from "./runtime-globals";
import type { InvalidateCause } from "./types";

function resolveComponentName(componentId: string | undefined): string | undefined {
  if (componentId == null || componentId.length === 0) return undefined;
  let label = componentId.trim();
  const hashIndex = label.lastIndexOf("#");
  if (hashIndex >= 0 && hashIndex < label.length - 1) {
    label = label.slice(hashIndex + 1);
  }
  label = label.split(/[\\/]/).pop() ?? label;
  label = label.replace(/\.(tsx?|jsx?|mjs|cjs)$/i, "");
  return label.length > 0 ? label : componentId;
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

interface LoaderStore {
  cache: Map<string, LoaderCacheEntry>;
  subscribers: Set<() => void>;
  pendingCause?: {
    cause: InvalidateCause;
    seenSubscribers: WeakSet<() => void>;
    remaining: number;
  };
}

interface ActiveTargetConsumer {
  store: LoaderStore;
  cacheKey: string;
  subscriber: () => void;
}

interface ActiveTarget {
  targetKey: string;
  componentId: string;
  componentName?: string;
  componentProps: unknown;
  consumers: Set<ActiveTargetConsumer>;
}

const DEFAULT_ACTION_ENDPOINT = "/rsc/action";
const loaderStores = new Set<LoaderStore>();
const activeTargets = new Map<string, ActiveTarget>();

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function toRejectedPromise(error: unknown): Promise<React.ReactNode> {
  const rejected = Promise.reject(toError(error));
  void rejected.catch(() => {});
  return rejected;
}

function createPromiseFromRows(
  rows: FlightRowMessage[],
  cause?: InvalidateCause,
): Promise<React.ReactNode> {
  try {
    const requestId = cause?.requestId ?? createTraceRequestId("batch");
    const globalState = globalThis as typeof globalThis & Record<string, unknown>;
    const runtime = globalState[DEFAULT_WORKER_RUNTIME_GLOBAL_KEY] as
      | { transport?: unknown }
      | undefined;
    const callServer =
      runtime != null && runtime.transport != null
        ? createCallServer(DEFAULT_ACTION_ENDPOINT, {
            transport: runtime.transport as any,
          })
        : createCallServer(DEFAULT_ACTION_ENDPOINT);
    const emitter = createFromRowEmitter<React.ReactNode>({
      callServer,
      traceContext: {
        requestId,
        actionId: cause?.actionId,
        source: "react",
      },
    });
    for (let i = 0; i < rows.length; i += 1) {
      emitter.push(rows[i]);
    }
    return emitter.result;
  } catch (error) {
    return toRejectedPromise(error);
  }
}

function notifySubscribers(subscribers: Set<() => void>): void {
  if (subscribers.size === 0) {
    return;
  }
  startTransition(() => {
    for (const subscriber of subscribers) {
      try {
        subscriber();
      } catch (error) {
        console.error("Error invalidating RSC", error);
      }
    }
  });
}

let localInvalidateGeneration = 0;

function nextLocalInvalidateGeneration(): number {
  localInvalidateGeneration += 1;
  return localInvalidateGeneration;
}

function resolveCause(cause?: InvalidateCause): InvalidateCause {
  if (cause != null) {
    return cause;
  }

  return {
    causeType: "manual",
    dispatchedAt: Date.now(),
    generation: nextLocalInvalidateGeneration(),
  };
}

function legacyInvalidateInternal(cause?: InvalidateCause): void {
  const resolvedCause = resolveCause(cause);
  const subscribers = new Set<() => void>();
  for (const store of loaderStores) {
    store.cache.clear();
    if (store.subscribers.size > 0) {
      store.pendingCause = {
        cause: resolvedCause,
        seenSubscribers: new WeakSet(),
        remaining: store.subscribers.size,
      };
    } else {
      store.pendingCause = undefined;
    }
    for (const subscriber of store.subscribers) {
      subscribers.add(subscriber);
    }
  }
  notifySubscribers(subscribers);
}

function collectTargetsInternal(): Array<{
  targetKey: string;
  componentId: string;
  componentProps: unknown;
}> {
  return Array.from(activeTargets.values(), (target) => ({
    targetKey: target.targetKey,
    componentId: target.componentId,
    componentProps: target.componentProps,
  }));
}

function applyBatchInternal(batch: RSCRefreshBatch, cause?: InvalidateCause): void {
  const resolvedCause = resolveCause(cause);
  const subscribers = new Set<() => void>();
  for (let i = 0; i < batch.entries.length; i += 1) {
    const entry = batch.entries[i];
    const target = activeTargets.get(entry.targetKey);
    if (target == null || target.consumers.size === 0) {
      continue;
    }
    const promise =
      entry.error != null
        ? toRejectedPromise(new Error(entry.error))
        : Array.isArray(entry.rows)
          ? createPromiseFromRows(entry.rows, resolvedCause)
          : toRejectedPromise(new Error(`Missing rows for "${entry.targetKey}"`));
    for (const consumer of target.consumers) {
      consumer.store.cache.delete(consumer.cacheKey);
      consumer.store.cache.set(consumer.cacheKey, {
        key: consumer.cacheKey,
        promise,
      });
      subscribers.add(consumer.subscriber);
    }
  }
  notifySubscribers(subscribers);
}

export function invalidateRSC(cause?: InvalidateCause) {
  legacyInvalidateInternal(cause);
}

setInvalidateRSC(invalidateRSC);
setRSCRefreshRuntime({
  collectTargets: collectTargetsInternal,
  applyBatch: applyBatchInternal,
  legacyInvalidate: legacyInvalidateInternal,
});

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
  const store: LoaderStore = {
    cache: new Map<string, LoaderCacheEntry>(),
    subscribers: new Set<() => void>(),
  };
  loaderStores.add(store);

  const referenceCandidate = reference as unknown as { $$id?: unknown };
  const componentId = typeof referenceCandidate.$$id === "string" ? referenceCandidate.$$id : null;
  const componentName =
    (typeof (referenceCandidate as { $$name?: unknown }).$$name === "string"
      ? ((referenceCandidate as { $$name?: string }).$$name ?? undefined)
      : undefined) ??
    (componentId != null ? resolveComponentName(componentId) : undefined) ??
    (typeof reference === "function" && reference.name.length > 0 ? reference.name : undefined);

  return function RSCLoader(props: RSCLoaderProps<Props>) {
    const [, $$refresh] = useState({});
    const cacheKey = createPropsToken(props);
    const targetKey = componentId == null ? null : `${componentId}|${cacheKey}`;
    const subscriberRef = useRef<(() => void) | null>(null);
    if (subscriberRef.current == null) {
      subscriberRef.current = () => {
        $$refresh({});
      };
    }

    useEffect(() => {
      const subscriber = subscriberRef.current;
      if (subscriber == null) {
        return;
      }

      store.subscribers.add(subscriber);

      let consumer: ActiveTargetConsumer | null = null;
      if (targetKey != null && componentId != null) {
        const target =
          activeTargets.get(targetKey) ??
          (() => {
            const next: ActiveTarget = {
              targetKey,
              componentId,
              componentName,
              componentProps: props,
              consumers: new Set<ActiveTargetConsumer>(),
            };
            activeTargets.set(targetKey, next);
            return next;
          })();
        consumer = {
          store,
          cacheKey,
          subscriber,
        };
        target.consumers.add(consumer);
      }

      return () => {
        store.subscribers.delete(subscriber);
        const pendingCause = store.pendingCause;
        if (pendingCause != null && !pendingCause.seenSubscribers.has(subscriber)) {
          pendingCause.seenSubscribers.add(subscriber);
          pendingCause.remaining -= 1;
          if (pendingCause.remaining <= 0) {
            store.pendingCause = undefined;
          }
        }
        if (consumer == null || targetKey == null) {
          return;
        }
        const target = activeTargets.get(targetKey);
        if (target == null) {
          return;
        }
        target.consumers.delete(consumer);
        if (target.consumers.size === 0) {
          activeTargets.delete(targetKey);
        }
      };
    }, [cacheKey, componentId, targetKey]);

    const cached = store.cache.get(cacheKey);
    if (cached != null) {
      return cached.promise;
    }

    const pendingCause = store.pendingCause;
    const subscriber = subscriberRef.current;
    if (
      pendingCause != null &&
      subscriber != null &&
      !pendingCause.seenSubscribers.has(subscriber)
    ) {
      pendingCause.seenSubscribers.add(subscriber);
      pendingCause.remaining -= 1;
      if (pendingCause.remaining <= 0) {
        store.pendingCause = undefined;
      }
    }

    const promise = fetchRSC(reference, { props });
    const entry = { key: cacheKey, promise } as const;
    store.cache.set(cacheKey, entry);

    return promise;
  };
}

let runtimePromise: Promise<{
  runtime: Awaited<ReturnType<typeof bootstrapWorkerRuntime>>;
  dispose: () => void;
}> | null = null;

function getRuntimePromise() {
  if (runtimePromise == null) {
    runtimePromise = bootstrapWorkerRuntime().then((runtime) => ({
      runtime,
      dispose: runtime.dispose.bind(runtime),
    }));
  }
  return runtimePromise;
}

export function RuntimeProvider({ children }: React.PropsWithChildren) {
  use(getRuntimePromise());
  return children;
}
