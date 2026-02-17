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

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value != null && "then" in value;
}

function encodeFlightRow(id: number, value: unknown): Uint8Array {
  return new TextEncoder().encode(`${id}:${JSON.stringify(value)}\n`);
}

interface EncodeContext {
  queueDeferred: (task: Promise<void>) => void;
  allocateRowId: () => number;
  emitRow: (id: number, value: unknown) => void;
}

async function encodeServerNode(value: unknown, context: EncodeContext): Promise<unknown> {
  if (isThenable(value)) {
    const rowId = context.allocateRowId();
    context.queueDeferred(
      (async () => {
        const resolved = await value;
        const encoded = await encodeServerNode(resolved, context);
        context.emitRow(rowId, encoded);
      })(),
    );
    return { $t: "rowRef", id: rowId };
  }

  if (Array.isArray(value)) {
    const encodedItems: unknown[] = [];
    for (const item of value) {
      encodedItems.push(await encodeServerNode(item, context));
    }
    return encodedItems;
  }

  if (!isReactElementLike(value)) {
    return encodeWireValue(value);
  }

  const type = value.type;
  if (typeof type === "function" && !isClientReference(type)) {
    return encodeServerNode(type(value.props), context);
  }
  if (type === REACT_FRAGMENT_SYMBOL) {
    return encodeServerNode(value.props.children, context);
  }

  const nextProps: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value.props)) {
    nextProps[key] = await encodeServerNode(item, context);
  }
  return encodeWireValue({
    ...value,
    props: nextProps,
  });
}

export async function renderToReadableStream(
  element: ReactNode,
  _moduleBasePath: unknown,
  options?: FlightServerRenderOptions,
): Promise<ReadableStream<Uint8Array>> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const signal = options?.signal;
      if (signal?.aborted) {
        controller.error(signal.reason);
        return;
      }

      let settled = false;
      const onAbort = () => {
        if (settled) return;
        settled = true;
        controller.error(signal?.reason);
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      try {
        let nextRowId = 1;
        const pendingRows = new Set<Promise<void>>();
        const queueDeferred = (task: Promise<void>): void => {
          pendingRows.add(task);
          task.finally(() => {
            pendingRows.delete(task);
          });
        };
        const context: EncodeContext = {
          queueDeferred,
          allocateRowId: () => {
            const current = nextRowId;
            nextRowId += 1;
            return current;
          },
          emitRow: (id, value) => {
            if (settled) return;
            controller.enqueue(encodeFlightRow(id, value));
          },
        };

        const root = await encodeServerNode(element, context);
        if (settled) return;
        controller.enqueue(encodeFlightRow(0, root));

        while (pendingRows.size > 0) {
          await Promise.race(pendingRows);
          if (settled) return;
        }

        controller.close();
        settled = true;
      } catch (error) {
        if (!settled) {
          settled = true;
          controller.error(error);
        }
      } finally {
        signal?.removeEventListener("abort", onAbort);
      }
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
