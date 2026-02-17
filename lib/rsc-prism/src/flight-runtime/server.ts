import type { ReactNode } from "react";
import { annotateServerReference } from "./references";
import type { FlightServerRenderOptions } from "./types";
import { encodeWireValue, decodeWireValue } from "./wire";
import { createClientModuleProxy } from "./references";

const CLIENT_REFERENCE_SYMBOL = Symbol.for("react.client.reference");
const REACT_ELEMENT_SYMBOL = Symbol.for("react.transitional.element");
const LEGACY_REACT_ELEMENT_SYMBOL = Symbol.for("react.element");
const REACT_FRAGMENT_SYMBOL = Symbol.for("react.fragment");

function isClientReference(value: unknown): value is { $$typeof: symbol; $$id: string } {
  if (typeof value !== "function" && (typeof value !== "object" || value == null)) {
    return false;
  }
  const candidate = value as { $$typeof?: unknown; $$id?: unknown };
  return candidate.$$typeof === CLIENT_REFERENCE_SYMBOL && typeof candidate.$$id === "string";
}

function isReactElementLike(value: unknown): value is {
  $$typeof: symbol;
  type: unknown;
  props: Record<string, unknown>;
} {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  const candidate = value as { $$typeof?: unknown };
  return candidate.$$typeof === REACT_ELEMENT_SYMBOL || candidate.$$typeof === LEGACY_REACT_ELEMENT_SYMBOL;
}

async function evaluateServerNode(value: unknown): Promise<unknown> {
  const awaited = await value;

  if (Array.isArray(awaited)) {
    return Promise.all(awaited.map((item) => evaluateServerNode(item)));
  }

  if (!isReactElementLike(awaited)) {
    return awaited;
  }

  const type = awaited.type;
  if (typeof type === "function" && !isClientReference(type)) {
    return evaluateServerNode(type(awaited.props));
  }
  if (type === REACT_FRAGMENT_SYMBOL) {
    return evaluateServerNode(awaited.props.children);
  }

  const nextProps: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(awaited.props)) {
    nextProps[key] = await evaluateServerNode(item);
  }
  return {
    ...awaited,
    props: nextProps,
  };
}

function encodeFlightChunk(value: unknown): Uint8Array {
  const encoded = encodeWireValue(value);
  const row = `0:${JSON.stringify(encoded)}\n`;
  return new TextEncoder().encode(row);
}

export async function renderToReadableStream(
  element: ReactNode,
  _moduleBasePath: unknown,
  options?: FlightServerRenderOptions,
): Promise<ReadableStream<Uint8Array>> {
  const rendered = await evaluateServerNode(element);
  const chunk = encodeFlightChunk(rendered);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (options?.signal?.aborted) {
        controller.error(options.signal.reason);
        return;
      }
      controller.enqueue(chunk);
      controller.close();
    },
  });
}

export async function decodeReply(
  body: FormData | string,
  _moduleBasePath: unknown,
  _options?: Record<string, unknown>,
): Promise<unknown> {
  let source: string;
  if (typeof body === "string") {
    source = body;
  } else {
    source = body.get("0")?.toString() ?? "null";
  }
  const parsed = JSON.parse(source);
  return decodeWireValue(parsed, (id) => createClientModuleProxy(id));
}

export function registerServerReference<T extends (...args: any[]) => any>(
  fn: T,
  id: string,
  _name: string | null = null,
): T {
  const annotated = annotateServerReference(fn, id);
  return annotated as T;
}
