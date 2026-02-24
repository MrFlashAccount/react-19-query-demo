import type { Color, IEventReceiver, ISpan, TraceEvent } from "@lib/tracing";

const RSC_PRISM_TRACER_GLOBAL_KEY = "__rscPrismTracer";

interface TracerLike {
  addReporter(reporter: IEventReceiver): () => void;
  deleteReporter(reporter: IEventReceiver): void;
  hasReporters(): boolean;
  startSpan(name: string, payload?: Record<string, unknown>, meta?: { color?: Color }): ISpan;
}

type LocalSpanState = "inactive" | "running" | "success" | "error";

class LocalSpan implements ISpan {
  private static nextSpanId = 1n;

  readonly spanId = LocalSpan.nextSpanId++ as unknown as ISpan["spanId"];
  readonly name: string;
  readonly parentSpan: ISpan | undefined;
  readonly payload: Record<string, unknown>;
  readonly meta: { color?: Color };
  private emit: (event: TraceEvent) => void;
  state: LocalSpanState = "inactive";
  startTime = 0;
  endTime = 0;

  constructor(options: {
    name: string;
    payload: Record<string, unknown>;
    parentSpan?: ISpan;
    meta?: { color?: Color };
    emit: (event: TraceEvent) => void;
  }) {
    this.name = options.name;
    this.payload = options.payload;
    this.parentSpan = options.parentSpan;
    this.meta = options.meta ?? {};
    this.emit = options.emit;
  }

  get serializedPayload(): string {
    return JSON.stringify(this.payload);
  }

  get duration(): number {
    if (this.endTime <= this.startTime) {
      return 0;
    }
    return this.endTime - this.startTime;
  }

  start(): void {
    if (this.state !== "inactive") {
      return;
    }
    this.state = "running";
    this.startTime = performance.now();
    this.emit({
      kind: "start",
      span: this,
      parentSpan: this.parentSpan,
      name: this.name,
      payload: this.payload,
      timestamp: this.startTime,
    });
  }

  event(eventName: string, payload?: Record<string, unknown>): void {
    if (this.state !== "running") {
      return;
    }
    this.emit({
      kind: "event",
      span: this,
      parentSpan: this.parentSpan,
      eventName,
      payload,
      timestamp: performance.now(),
    });
  }

  success(payload?: Record<string, unknown>): void {
    if (this.state !== "running") {
      return;
    }
    this.state = "success";
    this.endTime = performance.now();
    this.emit({
      kind: "end",
      span: this,
      parentSpan: this.parentSpan,
      payload,
      status: "success",
      timestamp: this.endTime,
    });
  }

  error(error: unknown, payload?: Record<string, unknown>): void {
    if (this.state !== "running") {
      return;
    }
    this.state = "error";
    this.endTime = performance.now();
    this.emit({
      kind: "end",
      span: this,
      parentSpan: this.parentSpan,
      payload,
      status: "error",
      error,
      timestamp: this.endTime,
    });
  }

  child(options: {
    name: string;
    payload?: Record<string, unknown>;
    meta?: { color?: Color };
  }): ISpan {
    const span = new LocalSpan({
      name: options.name,
      payload: options.payload ?? {},
      parentSpan: this,
      meta: options.meta,
      emit: this.emit,
    });
    span.start();
    return span;
  }

  [Symbol.dispose](): void {
    if (this.state === "running") {
      this.success();
    }
  }
}

class LocalTracer implements TracerLike {
  private reporters = new Set<IEventReceiver>();

  addReporter(reporter: IEventReceiver): () => void {
    this.reporters.add(reporter);
    return () => {
      this.reporters.delete(reporter);
    };
  }

  deleteReporter(reporter: IEventReceiver): void {
    this.reporters.delete(reporter);
  }

  hasReporters(): boolean {
    return this.reporters.size > 0;
  }

  startSpan(name: string, payload: Record<string, unknown> = {}, meta?: { color?: Color }): ISpan {
    const span = new LocalSpan({
      name,
      payload,
      parentSpan: undefined,
      meta,
      emit: (event) => {
        for (const reporter of this.reporters) {
          try {
            reporter.handleEvent(event);
          } catch {
            // Reporters are best-effort.
          }
        }
      },
    });
    span.start();
    return span;
  }
}

function resolveTracer(): TracerLike {
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  const existing = globalState[RSC_PRISM_TRACER_GLOBAL_KEY];
  if (existing != null && typeof (existing as TracerLike).startSpan === "function") {
    return existing as TracerLike;
  }

  const nextTracer = new LocalTracer();
  globalState[RSC_PRISM_TRACER_GLOBAL_KEY] = nextTracer;
  return nextTracer as TracerLike;
}

const tracer = resolveTracer();

const TRACE_MAX_VALUE_DEPTH = 4;
const TRACE_MAX_STRING_LENGTH = 512;
const TRACE_MAX_ARRAY_ITEMS = 24;
const TRACE_MAX_OBJECT_KEYS = 24;

export type TraceReporter = IEventReceiver;
export type TraceReporterEvent = TraceEvent;

export function addTraceReporter(reporter: TraceReporter): () => void {
  return tracer.addReporter(reporter);
}

export function removeTraceReporter(reporter: TraceReporter): void {
  tracer.deleteReporter(reporter);
}

export interface RSCTraceContext {
  requestId: string;
  actionId?: string;
  parentSpan?: ISpan;
  source: "client" | "transport" | "worker" | "server" | "react";
}

export interface InvalidateCause {
  causeType: "action-legacy-invalidate" | "action-batch-refresh" | "manual";
  requestId?: string;
  actionId?: string;
  parentSpan?: ISpan;
  dispatchedAt: number;
  generation: number;
}

export interface ComponentTraceContext {
  requestId?: string;
  actionId?: string;
  parentSpan?: ISpan;
  componentSeq: number;
}

export interface ComponentTraceTracker {
  requestId?: string;
  actionId?: string;
  parentSpan?: ISpan;
  componentSeq: number;
  stack: number[];
}

let requestSequence = 0;

export function shouldTrace(): boolean {
  try {
    return tracer.hasReporters();
  } catch {
    return false;
  }
}

function readStringField(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function resolveActionName(actionId: string | undefined): string | undefined {
  if (actionId == null || actionId.length === 0) {
    return undefined;
  }

  let label = actionId.trim();
  const hashIndex = label.lastIndexOf("#");
  if (hashIndex >= 0 && hashIndex < label.length - 1) {
    label = label.slice(hashIndex + 1);
  }
  label = label.split(/[\\/]/).pop() ?? label;
  const colonIndex = label.lastIndexOf(":");
  if (colonIndex >= 0 && colonIndex < label.length - 1) {
    label = label.slice(colonIndex + 1);
  }
  label = label.replace(/\.(tsx?|jsx?|mjs|cjs)$/i, "");
  return label.length > 0 ? label : actionId;
}

export function resolveComponentName(componentId: string | undefined): string | undefined {
  if (componentId == null || componentId.length === 0) {
    return undefined;
  }

  let label = componentId.trim();
  const hashIndex = label.lastIndexOf("#");
  if (hashIndex >= 0 && hashIndex < label.length - 1) {
    label = label.slice(hashIndex + 1);
  }
  label = label.split(/[\\/]/).pop() ?? label;
  label = label.replace(/\.(tsx?|jsx?|mjs|cjs)$/i, "");
  return label.length > 0 ? label : componentId;
}

function readableNameForTraceKey(name: string): string {
  const table: Record<string, string> = {
    "rsc.client.bootstrapWorkerRuntime": "Worker Send Bootstrap",
    "rsc.client.bootstrap.awaitReady": "Worker Decode Ready",
    "rsc.transport.worker.create": "Worker Send Transport Create",
    "rsc.client.fetchRSC": "Render Send Fetch",
    "rsc.flight.consumeStream": "Render Decode Stream",
    "rsc.client.callServer": "Action Send",
    "rsc.action.call": "Action Send",
    "rsc.action.encodeArgs": "Action Encode Args",
    "rsc.action.consumeResponse": "Action Decode Response",
    "rsc.transport.sendAction": "Action Send Transport",
    "rsc.transport.fetchRSC": "Render Send Transport",
    "rsc.transport.worker.request": "Worker Send Request",
    "rsc.transport.worker.rowRequest": "Worker Decode Rows",
    "rsc.react.invalidate": "Invalidate",
    "rsc.react.rerender.fetch": "Rerender Send Fetch",
    "rsc.react.applyBatch": "Rerender Decode Updates",
    "rsc.react.batch.target.decodeRows": "Rerender Decode Target Rows",
    "rsc.worker.request.action": "Action Send Worker Request",
    "rsc.server.executeAction": "Action Decode Server Execute",
    "rsc.worker.action.renderResultRows": "Action Render Result Rows",
    "rsc.worker.action.refreshTarget.render": "Rerender Render Target",
    "rsc.server.renderRSC": "Render Server",
    "rsc.server.renderRSCRows": "Render Server Rows",
    "rsc.server.decodeActionArgs": "Action Decode Args",
    "rsc.server.handleAction": "Action Decode Handle",
    "rsc.server.handleActionRows": "Action Decode Handle Rows",
    "rsc.response.render": "Render Response",
    "rsc.response.renderWithContext": "Render Response Context",
    "rsc.response.action": "Action Decode Response",
    "rsc.response.handler.ready": "Response Decode Ready",
    "rsc.response.handler.renderRows": "Render Decode Rows",
    "rsc.response.handler.actionRows": "Action Decode Rows",
    "rsc.worker.transport.message": "Worker Decode Message",
    "rsc.worker.transport.rowMessage": "Worker Decode Row Message",
  };
  return table[name] ?? name;
}

function resolveTraceDisplayName(name: string, payload: Record<string, unknown>): string {
  if (
    name === "rsc.component.render" ||
    name === "rsc.component.encode" ||
    name === "rsc.component.decode"
  ) {
    const componentLabel =
      readStringField(payload, "componentName") ??
      resolveComponentName(readStringField(payload, "componentId")) ??
      readStringField(payload, "hostTag");
    const phase =
      name === "rsc.component.render" ? "Render" : name === "rsc.component.encode" ? "Encode" : "Decode";
    const componentSeq = payload.componentSeq;
    const parentComponentSeq = payload.parentComponentSeq;
    const orderPrefix =
      typeof componentSeq === "number"
        ? typeof parentComponentSeq === "number"
          ? `${phase} #${componentSeq} (parent #${parentComponentSeq})`
          : `${phase} #${componentSeq}`
        : phase;
    return componentLabel != null ? `${orderPrefix}: ${componentLabel}` : orderPrefix;
  }

  const actionLabel =
    readStringField(payload, "actionName") ??
    resolveActionName(readStringField(payload, "actionId"));
  const componentLabel =
    readStringField(payload, "componentName") ??
    resolveComponentName(readStringField(payload, "componentId"));
  const operation = readStringField(payload, "operation");

  if (name === "rsc.action.call" || name === "rsc.client.callServer") {
    return actionLabel != null ? `Action Send: ${actionLabel}` : "Action Send";
  }
  if (name === "rsc.action.encodeArgs") {
    return actionLabel != null ? `Action Encode Args: ${actionLabel}` : "Action Encode Args";
  }
  if (name === "rsc.action.consumeResponse") {
    return actionLabel != null
      ? `Action Decode Response: ${actionLabel}`
      : "Action Decode Response";
  }
  if (name === "rsc.transport.sendAction") {
    return actionLabel != null ? `Action Send Transport: ${actionLabel}` : "Action Send Transport";
  }
  if (name === "rsc.react.rerender.fetch") {
    return componentLabel != null ? `Rerender Send Fetch: ${componentLabel}` : "Rerender Send Fetch";
  }
  if (name === "rsc.client.fetchRSC") {
    return componentLabel != null ? `Render Send Fetch: ${componentLabel}` : "Render Send Fetch";
  }
  if (name === "rsc.transport.worker.rowRequest") {
    if (operation === "action") {
      return actionLabel != null
        ? `Action Decode Rows (worker): ${actionLabel}`
        : "Action Decode Rows (worker)";
    }
    if (operation === "fetch") {
      return componentLabel != null
        ? `Render Decode Rows (worker): ${componentLabel}`
        : "Render Decode Rows (worker)";
    }
  }
  if (name === "rsc.transport.worker.request") {
    if (operation === "action") {
      return actionLabel != null
        ? `Action Send Request (worker): ${actionLabel}`
        : "Action Send Request (worker)";
    }
    if (operation === "fetch") {
      return componentLabel != null
        ? `Render Send Request (worker): ${componentLabel}`
        : "Render Send Request (worker)";
    }
  }

  return readableNameForTraceKey(name);
}

export function createTraceRequestId(prefix: string = "rsc"): string {
  requestSequence += 1;
  return `${prefix}-${Date.now()}-${requestSequence}`;
}

export function startTraceSpan(
  name: string,
  payload: Record<string, unknown> = {},
  parent?: ISpan,
  color: Color = "primary",
): ISpan | undefined {
  if (!shouldTrace()) {
    return undefined;
  }

  const spanPayload = payload;
  const displayName = resolveTraceDisplayName(name, spanPayload);

  try {
    if (parent != null) {
      return parent.child({
        name: displayName,
        payload: spanPayload,
        meta: { color },
      });
    }

    return tracer.startSpan(displayName, spanPayload, { color });
  } catch {
    return undefined;
  }
}

export function traceEvent(
  span: ISpan | undefined,
  eventName: string,
  payload?: Record<string, unknown>,
): void {
  if (span == null) {
    return;
  }

  try {
    span.event(eventName, payload);
  } catch {
    // Trace events must never break runtime behavior.
  }
}

export function finishTraceSpanSuccess(
  span: ISpan | undefined,
  payload?: Record<string, unknown>,
): void {
  if (span == null) {
    return;
  }

  try {
    span.success(payload);
  } catch {
    // Trace finalization must never break runtime behavior.
  }
}

export function finishTraceSpanError(
  span: ISpan | undefined,
  error: unknown,
  payload?: Record<string, unknown>,
): void {
  if (span == null) {
    return;
  }

  try {
    span.error(error, {
      ...payload,
      ...summarizeError(error),
    });
  } catch {
    // Trace finalization must never break runtime behavior.
  }
}

export function createComponentTraceTracker(
  context: Pick<ComponentTraceContext, "requestId" | "actionId" | "parentSpan"> = {},
): ComponentTraceTracker {
  return {
    requestId: context.requestId,
    actionId: context.actionId,
    parentSpan: context.parentSpan,
    componentSeq: 0,
    stack: [],
  };
}

export function startComponentPhaseSpan(
  tracker: ComponentTraceTracker | undefined,
  phase: "render" | "encode" | "decode",
  payload: {
    componentKind: string;
    componentName: string;
    hostTag?: string;
    rowId?: number;
    mode?: string;
    source?: string;
    phaseApplicable?: boolean;
  } & Record<string, unknown>,
): {
  span?: ISpan;
  componentSeq: number;
  parentComponentSeq?: number;
} {
  const nextSeq = (tracker?.componentSeq ?? 0) + 1;
  const parentComponentSeq = tracker?.stack[tracker.stack.length - 1];
  const {
    componentKind,
    componentName,
    hostTag,
    rowId,
    mode,
    source,
    phaseApplicable,
    ...restPayload
  } = payload;

  if (tracker != null) {
    tracker.componentSeq = nextSeq;
    tracker.stack.push(nextSeq);
  }

  const span = startTraceSpan(
    `rsc.component.${phase}`,
    {
      requestId: tracker?.requestId,
      actionId: tracker?.actionId,
      componentSeq: nextSeq,
      parentComponentSeq,
      componentKind,
      componentName,
      hostTag,
      rowId,
      mode,
      source,
      phase,
      phaseApplicable: phaseApplicable ?? true,
      ...restPayload,
    },
    tracker?.parentSpan,
    "secondary",
  );

  return {
    span,
    componentSeq: nextSeq,
    parentComponentSeq,
  };
}

export function endComponentPhaseSpan(
  tracker: ComponentTraceTracker | undefined,
  span: ISpan | undefined,
  error?: unknown,
  payload?: Record<string, unknown>,
): void {
  if (tracker != null) {
    tracker.stack.pop();
  }

  if (error == null) {
    finishTraceSpanSuccess(span, payload);
    return;
  }

  finishTraceSpanError(span, error, payload);
}

function summarizeString(value: string): string {
  if (value.length <= TRACE_MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, TRACE_MAX_STRING_LENGTH)}…`;
}

function summarizeTraceValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value == null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return summarizeString(value);
  }

  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (!Number.isFinite(value)) return String(value);
    if (Object.is(value, -0)) return "-0";
    return value;
  }

  if (typeof value === "bigint") {
    return `${String(value)}n`;
  }

  if (typeof value === "undefined") {
    return "undefined";
  }

  if (typeof value === "symbol") {
    return String(value);
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (typeof value !== "object") {
    return `[${typeof value}]`;
  }

  if (depth >= TRACE_MAX_VALUE_DEPTH) {
    return `[${summarizeValueType(value)}]`;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value
      .slice(0, TRACE_MAX_ARRAY_ITEMS)
      .map((item) => summarizeTraceValue(item, depth + 1, seen));
    if (value.length > TRACE_MAX_ARRAY_ITEMS) {
      result.push(`…(${value.length - TRACE_MAX_ARRAY_ITEMS} more)`);
    }
    return result;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof URL) {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: summarizeString(value.message),
    };
  }

  if (value instanceof URLSearchParams) {
    return Array.from(value.entries()).slice(0, TRACE_MAX_ARRAY_ITEMS);
  }

  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return {
      kind: "Blob",
      type: value.type,
      size: value.size,
    };
  }

  if (typeof FormData !== "undefined" && value instanceof FormData) {
    const entries = Array.from(value.entries())
      .slice(0, TRACE_MAX_ARRAY_ITEMS)
      .map(([key, entryValue]) => [
        key,
        typeof entryValue === "string"
          ? summarizeString(entryValue)
          : { kind: "File", name: entryValue.name, size: entryValue.size, type: entryValue.type },
      ]);
    return {
      kind: "FormData",
      entries,
      totalEntries: Array.from(value.keys()).length,
    };
  }

  if (value instanceof Map) {
    const entries = Array.from(value.entries())
      .slice(0, TRACE_MAX_ARRAY_ITEMS)
      .map(([key, item]) => [
        summarizeTraceValue(key, depth + 1, seen),
        summarizeTraceValue(item, depth + 1, seen),
      ]);
    return {
      kind: "Map",
      entries,
      size: value.size,
    };
  }

  if (value instanceof Set) {
    const entries = Array.from(value.values())
      .slice(0, TRACE_MAX_ARRAY_ITEMS)
      .map((entryValue) => summarizeTraceValue(entryValue, depth + 1, seen));
    return {
      kind: "Set",
      entries,
      size: value.size,
    };
  }

  if (value instanceof ArrayBuffer) {
    return {
      kind: "ArrayBuffer",
      byteLength: value.byteLength,
    };
  }

  if (ArrayBuffer.isView(value)) {
    return {
      kind: value.constructor.name,
      byteLength: value.byteLength,
    };
  }

  const entries = Object.entries(value as Record<string, unknown>).slice(0, TRACE_MAX_OBJECT_KEYS);
  const result: Record<string, unknown> = {};
  for (const [key, entryValue] of entries) {
    result[key] = summarizeTraceValue(entryValue, depth + 1, seen);
  }
  const totalKeys = Object.keys(value as Record<string, unknown>).length;
  if (totalKeys > TRACE_MAX_OBJECT_KEYS) {
    result.__truncatedKeys = totalKeys - TRACE_MAX_OBJECT_KEYS;
  }
  return result;
}

export function summarizeArgs(args: unknown[]): Record<string, unknown> {
  if (!shouldTrace()) {
    return {
      argsCount: args.length,
    };
  }

  const seen = new WeakSet<object>();
  return {
    argsCount: args.length,
    args: args.map((arg) => summarizeTraceValue(arg, 0, seen)),
  };
}

export function summarizeProps(props: unknown): Record<string, unknown> {
  if (props == null || typeof props !== "object") {
    return {
      propsType: summarizeValueType(props),
      propsKeyCount: 0,
    };
  }

  return {
    propsType: Array.isArray(props) ? "array" : "object",
    propsKeyCount: Object.keys(props as Record<string, unknown>).length,
  };
}

export function summarizeBody(body: BodyInit | undefined): Record<string, unknown> {
  if (body == null) {
    return {
      bodyKind: "empty",
      bodySize: 0,
    };
  }

  if (typeof body === "string") {
    return {
      bodyKind: "string",
      bodySize: body.length,
    };
  }

  if (body instanceof URLSearchParams) {
    const text = body.toString();
    return {
      bodyKind: "urlsearchparams",
      bodySize: text.length,
    };
  }

  if (body instanceof FormData) {
    return {
      bodyKind: "formdata",
      bodySize: Array.from(body.entries()).length,
    };
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return {
      bodyKind: "blob",
      bodySize: body.size,
    };
  }

  if (body instanceof ArrayBuffer) {
    return {
      bodyKind: "arraybuffer",
      bodySize: body.byteLength,
    };
  }

  if (ArrayBuffer.isView(body)) {
    return {
      bodyKind: body.constructor.name,
      bodySize: body.byteLength,
    };
  }

  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    return {
      bodyKind: "readablestream",
    };
  }

  return {
    bodyKind: summarizeValueType(body),
  };
}

export function summarizeHeaders(headers?: HeadersInit): Record<string, unknown> {
  if (headers == null) {
    return { headerCount: 0 };
  }

  return {
    headerCount: Array.from(new Headers(headers).keys()).length,
  };
}

export function summarizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
    };
  }

  return {
    errorName: "UnknownError",
    errorMessage: String(error),
  };
}

export function summarizeValueType(value: unknown): string {
  if (value == null) {
    return "null";
  }

  const type = typeof value;
  if (type !== "object") {
    return type;
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return (value as { constructor?: { name?: string } }).constructor?.name ?? "object";
}
