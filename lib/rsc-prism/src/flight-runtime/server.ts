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

const TEXT_ENCODER = new TextEncoder();

function encodeFlightRow(id: number, value: unknown): Uint8Array {
  return TEXT_ENCODER.encode(`${id}:${JSON.stringify(value)}\n`);
}

interface EncodeContext {
  queueDeferred: (task: Promise<void>) => void;
  allocateRowId: () => number;
  emitRow: (id: number, value: unknown) => void;
}

function encodeServerNode(value: unknown, context: EncodeContext): unknown | Promise<unknown> {
  if (isThenable(value)) {
    const rowId = context.allocateRowId();
    context.queueDeferred(
      Promise.resolve(value).then((resolved) =>
        Promise.resolve(encodeServerNode(resolved, context)).then((encoded) => {
          context.emitRow(rowId, encoded);
        }),
      ),
    );
    return { $t: "rowRef", id: rowId };
  }

  if (Array.isArray(value)) {
    const encodedItems = new Array<unknown>(value.length);
    let asyncFound = false;
    for (let i = 0; i < value.length; i += 1) {
      const encodedItem = encodeServerNode(value[i], context);
      encodedItems[i] = encodedItem;
      if (isThenable(encodedItem)) {
        asyncFound = true;
      }
    }
    if (!asyncFound) {
      return encodedItems;
    }
    return Promise.all(encodedItems.map((item) => Promise.resolve(item)));
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

  const entries = Object.entries(value.props);
  const nextProps: Record<string, unknown> = {};
  const pendingProps: Array<[string, Promise<unknown>]> = [];

  for (let i = 0; i < entries.length; i += 1) {
    const [key, item] = entries[i];
    const encodedProp = encodeServerNode(item, context);
    if (isThenable(encodedProp)) {
      pendingProps.push([key, Promise.resolve(encodedProp)]);
    } else {
      nextProps[key] = encodedProp;
    }
  }

  if (pendingProps.length === 0) {
    return encodeWireValue({
      ...value,
      props: nextProps,
    });
  }

  return Promise.all(pendingProps.map(([, promise]) => promise)).then((resolvedProps) => {
    for (let i = 0; i < pendingProps.length; i += 1) {
      const [key] = pendingProps[i];
      nextProps[key] = resolvedProps[i];
    }
    return encodeWireValue({
      ...value,
      props: nextProps,
    });
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
        let pendingRows = 0;
        let pendingRowsDrainPromise: Promise<void> | null = null;
        let resolvePendingRowsDrain: (() => void) | null = null;

        const queueDeferred = (task: Promise<void>): void => {
          pendingRows += 1;
          task.finally(() => {
            pendingRows -= 1;
            if (pendingRows === 0 && resolvePendingRowsDrain != null) {
              resolvePendingRowsDrain();
              resolvePendingRowsDrain = null;
              pendingRowsDrainPromise = null;
            }
          });
        };

        const waitForPendingRows = async (): Promise<void> => {
          if (pendingRows === 0) {
            return;
          }
          if (pendingRowsDrainPromise == null) {
            pendingRowsDrainPromise = new Promise<void>((resolve) => {
              resolvePendingRowsDrain = resolve;
            });
          }
          await pendingRowsDrainPromise;
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

        const root = await Promise.resolve(encodeServerNode(element, context));
        if (settled) return;
        controller.enqueue(encodeFlightRow(0, root));

        await waitForPendingRows();
        if (settled) return;

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
